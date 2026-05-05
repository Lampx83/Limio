"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/apiUrl";

interface OptionDraft {
  label: string;
  isCorrect: boolean;
  misconceptionId: string | null;
  extra: { side?: "left" | "right"; pairKey?: string } | null;
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
};

export default function EditQuestionForm({
  question,
  onClose,
}: {
  question: Question;
  onClose: () => void;
}) {
  const router = useRouter();
  const type = question.type;

  // ── scalar fields ──────────────────────────────────────────────────────────
  const [prompt, setPrompt] = useState(question.prompt);
  const [points, setPoints] = useState(question.points);
  const [explanation, setExplanation] = useState(question.explanation ?? "");

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
    setBusy(true);
    setError(null);

    const cleanOptions = hasOptions
      ? options.map((o) => ({
          label: o.label.trim(),
          isCorrect: type === "ordering" ? false : o.isCorrect,
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
      <div className="flex items-center gap-2 border-b border-token pb-3">
        <span className="chip">{TYPE_LABEL[type] ?? type}</span>
        <span className="text-sm font-semibold text-muted">Chỉnh sửa câu hỏi</span>
        <label className="ml-auto flex items-center gap-1.5 text-xs text-faint">
          Điểm
          <input
            type="number"
            min={1}
            max={100}
            value={points}
            onChange={(e) => setPoints(Number(e.target.value))}
            className="input w-16"
          />
        </label>
      </div>

      {/* Prompt */}
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        required
        rows={2}
        placeholder="Câu hỏi..."
        className="textarea"
      />

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
            <span className="text-xs font-semibold uppercase tracking-wide text-faint">
              Đáp án (số)
            </span>
            <input
              type="number"
              step="any"
              required
              value={numExpected}
              onChange={(e) => setNumExpected(e.target.value)}
              className="input mt-1"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-faint">
              Tolerance
            </span>
            <input
              type="number"
              step="any"
              min={0}
              value={numTolerance}
              onChange={(e) => setNumTolerance(e.target.value)}
              className="input mt-1"
            />
          </label>
        </div>
      )}

      {/* Options list */}
      {hasOptions && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-faint">
            Options ({options.length})
          </p>
          <p className="mt-0.5 text-xs text-faint">
            {type === "mcq" && "Đánh dấu câu đúng (checkbox)"}
            {type === "true_false" && "Chọn đáp án đúng (radio)"}
            {type === "fill_in" && "Mỗi label = đáp án chấp nhận được"}
            {type === "short_answer" && "Labels = exact match (case-insensitive)"}
            {type === "ordering" && "Thứ tự đúng = thứ tự bạn nhập"}
            {type === "matching" && "Mỗi pairKey phải có 1 left + 1 right"}
          </p>
          <ul className="mt-2 space-y-2">
            {options.map((o, i) => (
              <li
                key={i}
                className="flex items-center gap-2 rounded-lg border border-token bg-[rgb(var(--surface))] p-2"
              >
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

                {/* Matching side + pairKey */}
                {type === "matching" && (
                  <>
                    <select
                      value={o.extra?.side ?? "left"}
                      onChange={(e) =>
                        setOption(i, {
                          extra: {
                            side: e.target.value as "left" | "right",
                            pairKey: o.extra?.pairKey ?? "p1",
                          },
                        })
                      }
                      className="select w-14 px-1.5 text-xs"
                    >
                      <option value="left">L</option>
                      <option value="right">R</option>
                    </select>
                    <input
                      value={o.extra?.pairKey ?? ""}
                      onChange={(e) =>
                        setOption(i, {
                          extra: {
                            side: o.extra?.side ?? "left",
                            pairKey: e.target.value,
                          },
                        })
                      }
                      placeholder="pairKey"
                      className="input w-20 text-xs"
                    />
                  </>
                )}

                {/* Label */}
                <input
                  value={o.label}
                  onChange={(e) => setOption(i, { label: e.target.value })}
                  required
                  placeholder={
                    type === "fill_in" || type === "short_answer"
                      ? "Đáp án chấp nhận được"
                      : `Option ${i + 1}`
                  }
                  className="input flex-1"
                />

                {/* Misconception picker for wrong MCQ/T-F options */}
                {(type === "mcq" || type === "true_false") && !o.isCorrect && (
                  <select
                    value={o.misconceptionId ?? ""}
                    onChange={(e) => setOption(i, { misconceptionId: e.target.value || null })}
                    className="select max-w-[160px] text-xs"
                    title="Misconception"
                  >
                    <option value="">no misconception</option>
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
              </li>
            ))}
          </ul>
          {type !== "true_false" && (
            <button type="button" onClick={addOption} className="link mt-2 text-xs">
              + Thêm option
            </button>
          )}
        </div>
      )}

      {/* Short-answer regex */}
      {type === "short_answer" && (
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-faint">
            Regex chấp nhận thêm (mỗi dòng 1 pattern, optional)
          </span>
          <textarea
            value={acceptedRegexes}
            onChange={(e) => setAcceptedRegexes(e.target.value)}
            rows={2}
            placeholder="^h(e|a)llo$"
            className="textarea mt-1 font-mono text-xs"
          />
        </label>
      )}

      {/* Explanation */}
      <textarea
        value={explanation}
        onChange={(e) => setExplanation(e.target.value)}
        rows={2}
        placeholder="Giải thích (hiện trên result page, optional)"
        className="textarea"
      />

      {/* Skills */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-faint">Tag skills</p>
        {skills.length === 0 ? (
          <p className="mt-1 text-xs text-faint">Chưa có skill nào trong hệ thống.</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {skills.map((s) => {
              const picked = pickedSkillIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() =>
                    setPickedSkillIds((curr) =>
                      picked ? curr.filter((id) => id !== s.id) : [...curr, s.id],
                    )
                  }
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                    picked
                      ? "bg-brand-600 text-white"
                      : "border border-token bg-[rgb(var(--surface))] text-muted hover:border-brand-300 hover:text-brand-700"
                  }`}
                >
                  {s.code}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 border-t border-token pt-3">
        <button type="submit" disabled={busy} className="btn-primary btn-sm">
          {busy ? "Đang lưu..." : "Lưu thay đổi"}
        </button>
        <button type="button" onClick={onClose} className="btn-secondary btn-sm">
          Hủy
        </button>
        {error && <span className="text-xs text-danger-600">Lỗi: {error}</span>}
      </div>
    </form>
  );
}
