"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdaptiveTextField from "@/components/AdaptiveTextField";
import SkillTagPicker from "@/components/SkillTagPicker";
import MatchingPairsEditor from "@/components/MatchingPairsEditor";
import QuestionFormHeader, { FIELD_LABEL } from "./QuestionFormHeader";
import { apiUrl } from "@/lib/apiUrl";
import QuestionTypePicker from "./QuestionTypePicker";
import ImportMcqModal from "@/components/instructor/ImportMcqModal";


type QuestionType =
  | "mcq"
  | "true_false"
  | "fill_in"
  | "ordering"
  | "matching"
  | "numerical"
  | "essay"
  | "short_answer"
  | "drag_drop_fill";

interface OptionDraft {
  label: string;
  isCorrect: boolean;
  misconceptionId: string | null;
  // matching: { side, pairKey }; drag_drop_fill: { blankIndex }; else null.
  extra: {
    side?: "left" | "right";
    pairKey?: string;
    blankIndex?: number | null;
  } | null;
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

const blank = (over: Partial<OptionDraft> = {}): OptionDraft => ({
  label: "",
  isCorrect: false,
  misconceptionId: null,
  extra: null,
  ...over,
});

const DEFAULTS: Record<QuestionType, OptionDraft[]> = {
  mcq: [blank({ isCorrect: true }), blank(), blank()],
  true_false: [
    blank({ label: "Đúng", isCorrect: true }),
    blank({ label: "Sai" }),
  ],
  fill_in: [blank({ isCorrect: true })],
  short_answer: [blank({ isCorrect: true })],
  ordering: [blank(), blank(), blank()],
  matching: [
    blank({ extra: { side: "left", pairKey: "p1" } }),
    blank({ extra: { side: "right", pairKey: "p1" } }),
    blank({ extra: { side: "left", pairKey: "p2" } }),
    blank({ extra: { side: "right", pairKey: "p2" } }),
  ],
  numerical: [],
  essay: [],
  // 2 ô [[1]] [[2]] + 1 distractor. blankIndex bắt đầu từ 1 (không phải 0)
  // để khớp syntax prompt: [[1]], [[2]], ...
  drag_drop_fill: [
    blank({ extra: { blankIndex: 1 } }),
    blank({ extra: { blankIndex: 2 } }),
    blank({ extra: { blankIndex: null } }),
  ],
};

// Friendly Vietnamese labels — kept short to fit the badge in the form
// header. The picker card titles use the same labels for consistency.
const TYPE_LABEL: Record<QuestionType, string> = {
  mcq: "Trắc nghiệm",
  true_false: "Đúng / Sai",
  fill_in: "Điền khuyết",
  ordering: "Sắp xếp thứ tự",
  matching: "Ghép cặp",
  numerical: "Đáp án dạng số",
  essay: "Tự luận",
  short_answer: "Trả lời ngắn",
  drag_drop_fill: "Kéo thả từ/câu",
};

export default function AddQuestionForm({
  quizId,
  nextOrderIndex,
  startOpen = false,
  onCreated,
  onExit,
}: {
  quizId: string;
  nextOrderIndex: number;
  /** Trình soạn toàn trang: mở thẳng bộ chọn loại, không qua nút "+ Thêm câu hỏi". */
  startOpen?: boolean;
  /** Gọi sau khi tạo xong (thay cho việc đóng form) — để trang cha mở lại bộ chọn cho câu kế tiếp. */
  onCreated?: () => void;
  /** Gọi khi người dùng thoát khỏi bộ chọn/form mà không tạo (mũi tên quay lại, Hủy). */
  onExit?: () => void;
}) {
  const router = useRouter();
  // Three-stage flow:
  //   "closed"  → "+ Thêm câu hỏi" button only
  //   "picking" → visual type cards
  //   "editing" → full form with chosen type
  const [stage, setStage] = useState<"closed" | "picking" | "editing">(
    startOpen ? "picking" : "closed",
  );
  const [importOpen, setImportOpen] = useState(false);
  const [type, setType] = useState<QuestionType>("mcq");
  const [prompt, setPrompt] = useState("");
  const [points, setPoints] = useState(1);
  const [explanation, setExplanation] = useState("");
  const [options, setOptions] = useState<OptionDraft[]>(DEFAULTS.mcq);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [misconceptions, setMisconceptions] = useState<Misconception[]>([]);
  const [pickedSkillIds, setPickedSkillIds] = useState<string[]>([]);
  const [numExpected, setNumExpected] = useState("");
  const [numTolerance, setNumTolerance] = useState("0");
  const [acceptedRegexes, setAcceptedRegexes] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (stage === "closed") return;
    fetch(apiUrl("/api/skills"))
      .then((r) => r.json())
      .then((d) => setSkills(d.items ?? []))
      .catch(() => {});
    fetch(apiUrl("/api/misconceptions"))
      .then((r) => r.json())
      .then((d) => setMisconceptions(d.items ?? []))
      .catch(() => {});
  }, [stage]);

  function reset() {
    setPrompt("");
    setPoints(1);
    setExplanation("");
    setOptions(DEFAULTS[type]);
    setPickedSkillIds([]);
    setNumExpected("");
    setNumTolerance("0");
    setAcceptedRegexes("");
    setError(null);
  }

  function changeType(next: QuestionType) {
    setType(next);
    setOptions(DEFAULTS[next].map((o) => ({ ...o, extra: o.extra ? { ...o.extra } : null })));
  }

  function setOption(i: number, patch: Partial<OptionDraft>) {
    setOptions((curr) =>
      curr.map((o, idx) => (idx === i ? { ...o, ...patch } : o)),
    );
  }
  function setSingleCorrect(i: number) {
    setOptions((curr) => curr.map((o, idx) => ({ ...o, isCorrect: idx === i })));
  }
  function addOption() {
    setOptions((curr) => [...curr, blank({ isCorrect: false })]);
  }
  function removeOption(i: number) {
    setOptions((curr) => curr.filter((_, idx) => idx !== i));
  }

  async function createMisconception() {
    const code = window.prompt("Misconception code (lowercase + underscore):", "");
    if (!code) return;
    const name = window.prompt("Tên ngắn:", "");
    if (!name) return;
    const description = window.prompt("Mô tả:", "");
    if (description === null) return;
    const res = await fetch(apiUrl("/api/misconceptions"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, name, description: description || name }),
    });
    if (!res.ok) {
      alert("Tạo misconception thất bại");
      return;
    }
    const fresh = await fetch(apiUrl("/api/misconceptions")).then((r) => r.json());
    setMisconceptions(fresh.items ?? []);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const cleanOptions =
      type === "essay" || type === "numerical"
        ? undefined
        : options.map((o) => ({
            label: o.label.trim(),
            isCorrect: type === "ordering" ? false : o.isCorrect,
            misconceptionId: o.misconceptionId || undefined,
            extra: o.extra ?? undefined,
          }));

    const extra: Record<string, unknown> | undefined =
      type === "numerical"
        ? {
            expected: Number(numExpected),
            tolerance: Number(numTolerance) || 0,
          }
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

    const res = await fetch(apiUrl(`/api/quizzes/${quizId}/questions`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        prompt: prompt.trim(),
        points,
        orderIndex: nextOrderIndex,
        explanation: explanation.trim() || undefined,
        options: cleanOptions,
        extra,
        skillIds: pickedSkillIds,
      }),
    });
    setBusy(false);
    if (res.ok) {
      reset();
      router.refresh();
      if (onCreated) onCreated();
      else setStage("closed");
    } else {
      const d = await res.json().catch(() => ({}));
      setError(JSON.stringify(d.error ?? d) ?? "create_failed");
    }
  }

  if (stage === "closed") {
    return (
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setStage("picking")}
          className="rounded-lg border border-dashed border-token bg-[rgb(var(--surface))] px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-brand-300 hover:bg-brand-soft hover:text-brand-700"
        >
          + Thêm câu hỏi
        </button>
        <button
          onClick={() => setImportOpen(true)}
          className="rounded-lg border border-token bg-white px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-brand-300 hover:bg-brand-soft hover:text-brand-700"
        >
          ⬆ Import .xlsx
        </button>
        <ImportMcqModal
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onCommitted={() => router.refresh()}
          previewEndpoint={apiUrl(
            `/api/quizzes/${quizId}/questions/mcq-import-preview`,
          )}
          commitEndpoint={apiUrl(
            `/api/quizzes/${quizId}/questions/mcq-import-commit`,
          )}
          destinationLabel="quiz"
        />
      </div>
    );
  }

  if (stage === "picking") {
    return (
      <QuestionTypePicker
        onPick={(t) => {
          changeType(t);
          setStage("editing");
        }}
        onCancel={() => (onExit ? onExit() : setStage("closed"))}
      />
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-xl border border-token bg-[rgb(var(--surface-muted))] p-4"
    >
      {/* Type badge + back link + points. Type can still be changed by
          going back to the picker — keeps the visual flow consistent. */}
      <QuestionFormHeader
        typeLabel={TYPE_LABEL[type]}
        points={points}
        onPoints={setPoints}
        onChangeType={() => setStage("picking")}
      />

      <div>
        <span className={FIELD_LABEL}>
          Câu hỏi
        </span>
        <AdaptiveTextField
          value={prompt}
          onChange={setPrompt}
          placeholder="Nhập câu hỏi"
          minHeight={80}
        />
      </div>

      {type === "essay" && (
        <p className="rounded-lg border border-accent-200 bg-accent-50 p-3 text-xs text-accent-700">
          Essay chấm tay — học viên nộp text, instructor chấm điểm tại trang
          submissions.
        </p>
      )}

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
              value={numTolerance}
              onChange={(e) => setNumTolerance(e.target.value)}
              className="input mt-1"
            />
          </label>
        </div>
      )}

      {type === "drag_drop_fill" && (
        <div className="rounded-lg border border-accent-200 bg-accent-50 p-3 text-xs text-accent-700">
          <strong>Cách dùng:</strong> Trong nội dung câu hỏi, viết{" "}
          <code className="rounded bg-white px-1 py-0.5">[[1]]</code>,{" "}
          <code className="rounded bg-white px-1 py-0.5">[[2]]</code>… ở chỗ
          muốn tạo ô kéo thả. Bên dưới, mỗi token đặt "Vào ô số" = chỉ số ô
          tương ứng. Token có "Vào ô số" = 0 → distractor (xuất hiện trong pool
          nhưng không thuộc ô nào).
        </div>
      )}

      {type === "matching" && (
        <div>
          <p className={FIELD_LABEL}>Các cặp ghép ({Math.floor(options.length / 2)})</p>
          <MatchingPairsEditor options={options} onChange={setOptions} />
        </div>
      )}

      {(type === "mcq" ||
        type === "true_false" ||
        type === "fill_in" ||
        type === "short_answer" ||
        type === "ordering" ||
        type === "drag_drop_fill") && (
        <div>
          <p className={FIELD_LABEL}>
            {type === "drag_drop_fill" ? `Token (${options.length})` : `Đáp án (${options.length})`}
          </p>
          <p className="-mt-1 mb-2 text-xs text-faint">
            {type === "mcq" && "Đánh dấu nhiều câu đúng nếu cần"}
            {type === "true_false" && "Chọn đáp án đúng (radio)"}
            {type === "fill_in" && "Mỗi label = đáp án chấp nhận được"}
            {type === "short_answer" && "Labels = exact match (case-insensitive)"}
            {type === "ordering" && "Thứ tự đúng = thứ tự bạn nhập"}
            {type === "drag_drop_fill" && "Token có 'Vào ô số' = N sẽ là đáp án đúng cho ô [[N]]"}
          </p>
          <ul className="mt-2 space-y-2">
            {options.map((o, i) => {
              // Rich text labels (with image support) only make sense for
              // option-based answer types. Fill-in / short-answer compare the
              // label string against the learner response, so they must stay
              // plain. True/false labels are fixed semantic markers.
              const useRichLabel =
                type === "mcq" ||
                type === "ordering" ||
                type === "drag_drop_fill";
              return (
                <li
                  key={i}
                  className="rounded-lg border border-token bg-[rgb(var(--surface))] p-2"
                >
                  <div className="flex items-center gap-2">
                    {(type === "mcq" || type === "true_false") && (
                      <input
                        type={type === "true_false" ? "radio" : "checkbox"}
                        name={type === "true_false" ? "tf-correct" : undefined}
                        checked={o.isCorrect}
                        onChange={(e) => {
                          if (type === "true_false") setSingleCorrect(i);
                          else setOption(i, { isCorrect: e.target.checked });
                        }}
                        className="h-4 w-4 accent-success-600"
                      />
                    )}
                    {type === "drag_drop_fill" && (
                      <label className="flex items-center gap-1 text-xs text-faint">
                        Vào ô số
                        <input
                          type="number"
                          min={0}
                          max={20}
                          value={o.extra?.blankIndex ?? 0}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setOption(i, {
                              extra: {
                                blankIndex:
                                  Number.isFinite(v) && v >= 1 ? v : null,
                              },
                            });
                          }}
                          className="input w-14 text-xs"
                          title="N = đáp án đúng cho ô [[N]]; 0 = distractor"
                        />
                      </label>
                    )}
                    {!useRichLabel && (
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
                    )}
                    {useRichLabel && (
                      <span className="flex-1 text-xs text-faint">
                        Đáp án {i + 1}
                      </span>
                    )}
                    {(type === "mcq" || type === "true_false") && !o.isCorrect && (
                      <select
                        value={o.misconceptionId ?? ""}
                        onChange={(e) =>
                          setOption(i, { misconceptionId: e.target.value || null })
                        }
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
                        placeholder={`Đáp án ${i + 1}`}
                        minHeight={48}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-2 flex flex-wrap gap-3 text-xs">
            {type !== "true_false" && (
              <button type="button" onClick={addOption} className="link">
                + Thêm đáp án
              </button>
            )}
            {(type === "mcq" || type === "true_false") && (
              <button type="button" onClick={createMisconception} className="link">
                + Tạo quan niệm sai mới
              </button>
            )}
          </div>
        </div>
      )}

      {type === "short_answer" && (
        <label className="block">
          <span className={FIELD_LABEL}>
            Regex chấp nhận thêm (mỗi dòng 1 mẫu, không bắt buộc)
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
            placeholder="Vì sao đáp án này đúng"
            minHeight={100}
          />
        </div>
      </div>

      <div>
        <p className={FIELD_LABEL}>
          Chủ đề
        </p>
        <SkillTagPicker
          skills={skills}
          picked={pickedSkillIds}
          onChange={setPickedSkillIds}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-token pt-3">
        <button type="submit" disabled={busy} className="btn-primary btn-sm">
          {busy ? "..." : "Tạo câu hỏi"}
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            if (onExit) onExit();
            else setStage("closed");
          }}
          className="btn-secondary btn-sm"
        >
          Hủy
        </button>
        {error && (
          <span className="text-xs text-danger-600">Lỗi: {error}</span>
        )}
      </div>
    </form>
  );
}
