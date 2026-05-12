"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { apiUrl } from "@/lib/apiUrl";

const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), {
  ssr: false,
});

type QuestionType =
  | "mcq"
  | "true_false"
  | "fill_in"
  | "ordering"
  | "matching"
  | "numerical"
  | "essay"
  | "short_answer";

interface OptionDraft {
  label: string;
  isCorrect: boolean;
  misconceptionId: string | null;
  extra: { side?: "left" | "right"; pairKey?: string } | null;
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
};

const TYPE_LABEL: Record<QuestionType, string> = {
  mcq: "MCQ — Chọn nhiều",
  true_false: "Đúng / Sai",
  fill_in: "Điền từ",
  ordering: "Sắp xếp",
  matching: "Ghép cặp",
  numerical: "Số",
  essay: "Tự luận (chấm tay)",
  short_answer: "Trả lời ngắn (regex)",
};

export default function AddQuestionForm({
  quizId,
  nextOrderIndex,
}: {
  quizId: string;
  nextOrderIndex: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
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
    if (!open) return;
    fetch(apiUrl("/api/skills"))
      .then((r) => r.json())
      .then((d) => setSkills(d.items ?? []))
      .catch(() => {});
    fetch(apiUrl("/api/misconceptions"))
      .then((r) => r.json())
      .then((d) => setMisconceptions(d.items ?? []))
      .catch(() => {});
  }, [open]);

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
      setOpen(false);
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(JSON.stringify(d.error ?? d) ?? "create_failed");
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-dashed border-token bg-[rgb(var(--surface))] px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-brand-300 hover:bg-brand-soft hover:text-brand-700"
      >
        + Thêm câu hỏi
      </button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-xl border border-token bg-[rgb(var(--surface-muted))] p-4"
    >
      {/* Type + points */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="block flex-1 min-w-[200px]">
          <span className="text-xs font-semibold uppercase tracking-wide text-faint">
            Loại câu hỏi
          </span>
          <select
            value={type}
            onChange={(e) => changeType(e.target.value as QuestionType)}
            className="select mt-1"
          >
            {(Object.keys(TYPE_LABEL) as QuestionType[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-faint">
            Điểm
          </span>
          <input
            type="number"
            min={1}
            max={100}
            value={points}
            onChange={(e) => setPoints(Number(e.target.value))}
            className="input mt-1 w-20"
          />
        </label>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        required
        rows={2}
        placeholder="Câu hỏi..."
        className="textarea"
      />

      {type === "essay" && (
        <p className="rounded-lg border border-accent-200 bg-accent-50 p-3 text-xs text-accent-700">
          Essay chấm tay — học viên nộp text, instructor chấm điểm tại trang
          submissions.
        </p>
      )}

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

      {(type === "mcq" ||
        type === "true_false" ||
        type === "fill_in" ||
        type === "short_answer" ||
        type === "ordering" ||
        type === "matching") && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-faint">
            Options ({options.length})
          </p>
          <p className="mt-0.5 text-xs text-faint">
            {type === "mcq" && "Đánh dấu nhiều câu đúng nếu cần"}
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
                {(type === "mcq" || type === "true_false") && !o.isCorrect && (
                  <select
                    value={o.misconceptionId ?? ""}
                    onChange={(e) =>
                      setOption(i, { misconceptionId: e.target.value || null })
                    }
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
          <div className="mt-2 flex flex-wrap gap-3 text-xs">
            {type !== "true_false" && (
              <button type="button" onClick={addOption} className="link">
                + Thêm option
              </button>
            )}
            {(type === "mcq" || type === "true_false") && (
              <button type="button" onClick={createMisconception} className="link">
                + Tạo misconception mới
              </button>
            )}
          </div>
        </div>
      )}

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

      <RichTextEditor
        value={explanation}
        onChange={setExplanation}
        placeholder="Giải thích (hiện trên result page, optional)"
        minHeight={100}
      />

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-faint">
          Tag skills
        </p>
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
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-token pt-3">
        <button type="submit" disabled={busy} className="btn-primary btn-sm">
          {busy ? "..." : "Tạo câu hỏi"}
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
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
