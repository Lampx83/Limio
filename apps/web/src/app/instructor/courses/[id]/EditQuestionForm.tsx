"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdaptiveTextField, { needsRich } from "@/components/AdaptiveTextField";
import { PROMPT_EXAMPLE, explanationExample, optionExample, NUMERICAL_EXAMPLE } from "@/lib/questionExamples";
import SkillTagPicker from "@/components/SkillTagPicker";
import MatchingPairsEditor from "@/components/MatchingPairsEditor";
import DragDropFillEditor from "@/components/DragDropFillEditor";
import QuestionFormHeader, { FIELD_LABEL } from "./QuestionFormHeader";
import { apiUrl } from "@/lib/apiUrl";
import { plainToRichHtml } from "@/lib/richText";


interface OptionDraft {
  label: string;
  isCorrect: boolean;
  misconceptionId: string | null;
  extra: { side?: "left" | "right"; pairKey?: string; blankIndex?: number | null } | null;
}

interface ExistingOption {
  id: string;
  label: string;
  isCorrect: boolean;
  orderIndex: number;
  misconceptionId: string | null;
  misconception: { id: string; code: string; name: string } | null;
  extra: unknown;
}

interface Question {
  id: string;
  type: string;
  prompt: string;
  points: number;
  orderIndex: number;
  explanation: string | null;
  extra: unknown;
  options: ExistingOption[];
  skillTags: Array<{ skillId: string; skill: { code: string; name: string } }>;
}

interface Skill {
  id: string;
  code: string;
  name: string;
}

interface Misconception {
  id: string;
  code: string;
  name: string;
}

const TYPE_LABEL: Record<string, string> = {
  mcq: "MCQ",
  true_false: "Đúng / Sai",
  fill_in: "Điền từ",
  ordering: "Sắp xếp",
  matching: "Ghép cặp",
  numerical: "Số",
  essay: "Tự luận",
  short_answer: "Trả lời ngắn",
  drag_drop_fill: "Kéo thả từ/câu",
};

export default function EditQuestionForm({
  question,
  onClose,
  hideCancel = false,
}: {
  question: Question;
  onClose: () => void;
  /** Trình soạn toàn trang sửa tại chỗ, không có trạng thái "đóng" để quay về. */
  hideCancel?: boolean;
}) {
  const router = useRouter();
  const type = question.type;

  // ── scalar fields ──────────────────────────────────────────────────────────
  const [prompt, setPrompt] = useState(question.prompt);
  const [points, setPoints] = useState(question.points);
  const [explanation, setExplanation] = useState(plainToRichHtml(question.explanation ?? ""));

  // ── options ────────────────────────────────────────────────────────────────
  const [options, setOptions] = useState<OptionDraft[]>(() =>
    [...question.options]
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((o) => ({
        label: o.label,
        isCorrect: o.isCorrect,
        misconceptionId: o.misconceptionId,
        extra: (o.extra as OptionDraft["extra"]) ?? null,
      })),
  );

  // ── type-specific extra ────────────────────────────────────────────────────
  const initExtra = (question.extra ?? {}) as {
    expected?: number;
    tolerance?: number;
    acceptedRegexes?: string[];
  };
  const [numExpected, setNumExpected] = useState(String(initExtra.expected ?? ""));
  const [numTolerance, setNumTolerance] = useState(String(initExtra.tolerance ?? "0"));
  const [acceptedRegexes, setAcceptedRegexes] = useState(
    (initExtra.acceptedRegexes ?? []).join("\n"),
  );

  // ── skills & misconceptions ────────────────────────────────────────────────
  const [skills, setSkills] = useState<Skill[]>([]);
  const [misconceptions, setMisconceptions] = useState<Misconception[]>([]);
  const [pickedSkillIds, setPickedSkillIds] = useState<string[]>(
    question.skillTags.map((t) => t.skillId),
  );

  // ── submit state ───────────────────────────────────────────────────────────
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(apiUrl("/api/skills"))
      .then((r) => r.json())
      .then((d) => setSkills(d.items ?? []))
      .catch(() => {});
    fetch(apiUrl("/api/misconceptions"))
      .then((r) => r.json())
      .then((d) => setMisconceptions(d.items ?? []))
      .catch(() => {});
  }, []);

  // ── option helpers ─────────────────────────────────────────────────────────
  function setOption(i: number, patch: Partial<OptionDraft>) {
    setOptions((curr) => curr.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  }
  function setSingleCorrect(i: number) {
    setOptions((curr) => curr.map((o, idx) => ({ ...o, isCorrect: idx === i })));
  }
  function addOption() {
    setOptions((curr) => [...curr, { label: "", isCorrect: false, misconceptionId: null, extra: null }]);
  }
  function removeOption(i: number) {
    setOptions((curr) => curr.filter((_, idx) => idx !== i));
  }

  const hasOptions = !["essay", "numerical"].includes(type);

  // ── submit ─────────────────────────────────────────────────────────────────
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (type === "drag_drop_fill" && !/\[\[\d+\]\]/.test(prompt)) {
      setError("Câu hỏi cần ít nhất một ô trống — bấm \"Chèn ô trống\".");
      return;
    }
    setBusy(true);
    setError(null);

    const cleanOptions = hasOptions
      ? options.map((o) => ({
          label: o.label.trim(),
          isCorrect:
              type === "ordering"
                ? false
                : type === "fill_in" || type === "short_answer"
                  ? true
                  : o.isCorrect,
          misconceptionId: o.misconceptionId || undefined,
          extra: o.extra ?? undefined,
        }))
      : undefined;

    const extra: Record<string, unknown> | undefined =
      type === "numerical"
        ? { expected: Number(numExpected), tolerance: Number(numTolerance) || 0 }
        : type === "short_answer"
          ? acceptedRegexes.trim()
            ? {
                acceptedRegexes: acceptedRegexes
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
              }
            : undefined
          : undefined;

    const res = await fetch(apiUrl(`/api/questions/${question.id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: prompt.trim(),
        points,
        explanation: explanation.trim() || null,
        options: cleanOptions,
        extra,
        skillIds: pickedSkillIds,
      }),
    });

    setBusy(false);
    if (res.ok) {
      onClose();
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(
        typeof d.error === "string" ? d.error : JSON.stringify(d.error ?? d) ?? "update_failed",
      );
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-xl border border-brand-200 bg-[rgb(var(--surface-muted))] p-4"
    >
      {/* Header */}
      <QuestionFormHeader
        typeLabel={TYPE_LABEL[type] ?? type}
        points={points}
        onPoints={setPoints}
      />

      {/* Prompt */}
      {(type !== "drag_drop_fill" || needsRich(prompt)) && (
        <div>
          <span className={FIELD_LABEL}>
            Câu hỏi
          </span>
          <AdaptiveTextField
            value={prompt}
            onChange={setPrompt}
            placeholder={PROMPT_EXAMPLE[type] ?? "Nhập câu hỏi"}
            minHeight={80}
          />
        </div>
      )}

      {/* Essay info */}
      {type === "essay" && (
        <p className="rounded-lg border border-accent-200 bg-accent-50 p-3 text-xs text-accent-700">
          Essay chấm tay — học viên nộp text, instructor chấm điểm tại trang submissions.
        </p>
      )}

      {/* Numerical */}
      {type === "numerical" && (
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={FIELD_LABEL}>
              Đáp án (số)
            </span>
            <input
              type="number"
              step="any"
              required
              placeholder={NUMERICAL_EXAMPLE.expected}
              value={numExpected}
              onChange={(e) => setNumExpected(e.target.value)}
              className="input mt-1"
            />
          </label>
          <label className="block">
            <span className={FIELD_LABEL}>
              Sai số cho phép
            </span>
            <input
              type="number"
              step="any"
              min={0}
              placeholder={NUMERICAL_EXAMPLE.tolerance}
              value={numTolerance}
              onChange={(e) => setNumTolerance(e.target.value)}
              className="input mt-1"
            />
          </label>
        </div>
      )}

      {type === "matching" && (
        <div>
          <p className={FIELD_LABEL}>Các cặp ghép ({Math.floor(options.length / 2)})</p>
          <MatchingPairsEditor options={options} onChange={setOptions} />
        </div>
      )}

      {type === "drag_drop_fill" && (
        <DragDropFillEditor
          prompt={prompt}
          onPrompt={setPrompt}
          options={options}
          onChange={setOptions}
        />
      )}

      {/* Options list */}
      {hasOptions && type !== "matching" && type !== "drag_drop_fill" && (
        <div>
          <p className={FIELD_LABEL}>
            {type === "fill_in" || type === "short_answer"
              ? "Đáp án chấp nhận được"
              : `Đáp án (${options.length})`}
          </p>
          <p className="-mt-1 mb-2 text-xs text-faint">
            {type === "mcq" && "Đánh dấu câu đúng (checkbox)"}
            {type === "true_false" && "Chọn đáp án đúng (radio)"}
            {(type === "fill_in" || type === "short_answer") &&
              "Học viên đúng khi câu trả lời khớp một trong các đáp án dưới đây. Không phân biệt hoa thường và khoảng trắng thừa, nhưng dấu tiếng Việt phải đúng."}
            {type === "ordering" && "Thứ tự đúng = thứ tự bạn nhập"}
          </p>
          <ul className="mt-2 space-y-2">
            {options.map((o, i) => {
              // Rich text labels (with image support) only for option-based
              // types. See AddQuestionForm for rationale.
              const useRichLabel =
                type === "mcq" || type === "ordering";
              return (
                <li
                  key={i}
                  className="rounded-lg border border-token bg-[rgb(var(--surface))] p-2"
                >
                  <div className="flex items-center gap-2">
                    {/* Correct toggle */}
                    {(type === "mcq" || type === "true_false") && (
                      <input
                        type={type === "true_false" ? "radio" : "checkbox"}
                        name={type === "true_false" ? `tf-edit-${question.id}` : undefined}
                        checked={o.isCorrect}
                        onChange={() => {
                          if (type === "true_false") setSingleCorrect(i);
                          else setOption(i, { isCorrect: !o.isCorrect });
                        }}
                        className="h-4 w-4 accent-success-600"
                      />
                    )}


                    {/* Plain label inline (fill_in / short_answer / true_false) */}
                    {!useRichLabel && (
                      <input
                        value={o.label}
                        onChange={(e) => setOption(i, { label: e.target.value })}
                        required
                        placeholder={
                          optionExample(type, i) ??
                          (type === "fill_in" || type === "short_answer"
                            ? "Đáp án chấp nhận được"
                            : `Đáp án ${i + 1}`)
                        }
                        className="input flex-1"
                      />
                    )}
                    {useRichLabel && (
                      <span className="flex-1 text-xs text-faint">
                        Đáp án {i + 1}
                      </span>
                    )}

                    {/* Misconception picker for wrong MCQ/T-F options */}
                    {(type === "mcq" || type === "true_false") && !o.isCorrect && (
                      <select
                        value={o.misconceptionId ?? ""}
                        onChange={(e) => setOption(i, { misconceptionId: e.target.value || null })}
                        className="select max-w-[160px] text-xs"
                        title="Misconception"
                      >
                        <option value="">Không gắn quan niệm sai</option>
                        {misconceptions.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.code}
                          </option>
                        ))}
                      </select>
                    )}

                    {/* Remove option */}
                    {type !== "true_false" && options.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeOption(i)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-danger-100 text-xs text-danger-600 hover:bg-danger-50"
                        aria-label="Xóa option"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  {useRichLabel && (
                    <div className="mt-2">
                      <AdaptiveTextField
                        value={o.label}
                        onChange={(html) => setOption(i, { label: html })}
                        placeholder={optionExample(type, i) ?? `Đáp án ${i + 1}`}
                        minHeight={48}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {type !== "true_false" && (
            <button type="button" onClick={addOption} className="link mt-2 text-xs">
              {type === "fill_in" || type === "short_answer"
                  ? "+ Thêm cách viết khác"
                  : "+ Thêm đáp án"}
            </button>
          )}
        </div>
      )}

      {/* Short-answer regex */}
      {type === "short_answer" && (
        <details className="group" open={acceptedRegexes.trim() !== ""}>
          <summary className="cursor-pointer text-sm text-muted hover:text-brand-700">
            Nâng cao: chấp nhận theo mẫu (regex)
          </summary>
          <p className="mb-2 mt-2 text-xs text-faint">
            Dùng khi có nhiều cách viết khó liệt kê hết. Mỗi dòng một mẫu, không phân biệt hoa thường.
            Ví dụ <code>^h(e|a)llo$</code> nhận "hello" và "hallo".
          </p>
          <textarea
            value={acceptedRegexes}
            onChange={(e) => setAcceptedRegexes(e.target.value)}
            rows={2}
            aria-label="Mẫu regex chấp nhận thêm"
            className="textarea font-mono text-xs"
          />
        </details>
      )}

      {/* Explanation */}
      <div>
        <span className={FIELD_LABEL}>
          Giải thích <span className="font-normal normal-case text-faint">(không bắt buộc)</span>
        </span>
        <p className="-mt-1 mb-2 text-xs text-faint">
          Hiện cho học viên ở trang kết quả, sau khi làm xong.
        </p>
        <div className="mt-2">
          <AdaptiveTextField
            value={explanation}
            onChange={setExplanation}
            placeholder={explanationExample(type)}
            minHeight={100}
          />
        </div>
      </div>

      {/* Skills */}
      <div>
        <p className={FIELD_LABEL}>Chủ đề</p>
        <SkillTagPicker
          skills={skills}
          picked={pickedSkillIds}
          onChange={setPickedSkillIds}
        />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 border-t border-token pt-3">
        <button type="submit" disabled={busy} className="btn-primary btn-sm">
          {busy ? "Đang lưu..." : "Lưu thay đổi"}
        </button>
        {!hideCancel && (
          <button type="button" onClick={onClose} className="btn-secondary btn-sm">
            Hủy
          </button>
        )}
        {error && <span className="text-xs text-danger-600">Lỗi: {error}</span>}
      </div>
    </form>
  );
}
