"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
  // matching: { side: 'left' | 'right', pairKey: string }
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
  // numerical-specific:
  const [numExpected, setNumExpected] = useState("");
  const [numTolerance, setNumTolerance] = useState("0");
  // short_answer-specific:
  const [acceptedRegexes, setAcceptedRegexes] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/skills")
      .then((r) => r.json())
      .then((d) => setSkills(d.items ?? []))
      .catch(() => {});
    fetch("/api/misconceptions")
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
    const res = await fetch("/api/misconceptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, name, description: description || name }),
    });
    if (!res.ok) {
      alert("Tạo misconception thất bại");
      return;
    }
    const fresh = await fetch("/api/misconceptions").then((r) => r.json());
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

    const res = await fetch(`/api/quizzes/${quizId}/questions`, {
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
        className="text-xs text-slate-500 underline hover:text-slate-700 dark:hover:text-slate-300"
      >
        + Thêm câu hỏi
      </button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded border border-slate-300 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-900/40"
    >
      <div className="flex items-center gap-3">
        <label>
          <span className="font-medium uppercase text-slate-500">Type</span>
          <select
            value={type}
            onChange={(e) => changeType(e.target.value as QuestionType)}
            className="ml-1 rounded border border-slate-300 px-2 py-1 dark:bg-slate-900 dark:border-slate-700"
          >
            <option value="mcq">mcq</option>
            <option value="true_false">true_false</option>
            <option value="fill_in">fill_in</option>
            <option value="ordering">ordering</option>
            <option value="matching">matching</option>
            <option value="numerical">numerical</option>
            <option value="essay">essay (manual graded)</option>
            <option value="short_answer">short_answer (regex)</option>
          </select>
        </label>
        <label>
          <span className="font-medium uppercase text-slate-500">Points</span>
          <input
            type="number"
            min={1}
            max={100}
            value={points}
            onChange={(e) => setPoints(Number(e.target.value))}
            className="ml-1 w-14 rounded border border-slate-300 px-1 py-0.5 dark:bg-slate-900 dark:border-slate-700"
          />
        </label>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        required
        rows={2}
        placeholder="Câu hỏi"
        className="w-full rounded border border-slate-300 px-2 py-1 text-sm dark:bg-slate-900 dark:border-slate-700"
      />

      {/* Per-type body */}
      {type === "essay" && (
        <p className="rounded bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
          Essay chấm tay — học viên nộp text, instructor chấm điểm tại trang
          submissions.
        </p>
      )}

      {type === "numerical" && (
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className="font-medium uppercase text-slate-500">Đáp án (số)</span>
            <input
              type="number"
              step="any"
              required
              value={numExpected}
              onChange={(e) => setNumExpected(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 dark:bg-slate-900 dark:border-slate-700"
            />
          </label>
          <label>
            <span className="font-medium uppercase text-slate-500">Tolerance</span>
            <input
              type="number"
              step="any"
              min={0}
              value={numTolerance}
              onChange={(e) => setNumTolerance(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 dark:bg-slate-900 dark:border-slate-700"
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
          <p className="font-medium uppercase text-slate-500">
            Options ({options.length})
            {type === "mcq" && " — đánh dấu nhiều câu đúng nếu cần"}
            {type === "true_false" && " — chọn đáp án đúng (radio)"}
            {type === "fill_in" && " — mỗi label = đáp án chấp nhận được"}
            {type === "short_answer" && " — labels = exact match (case-insensitive)"}
            {type === "ordering" && " — thứ tự đúng = thứ tự bạn nhập"}
            {type === "matching" && " — mỗi pairKey phải có 1 left + 1 right"}
          </p>
          <ul className="mt-1 space-y-1">
            {options.map((o, i) => (
              <li key={i} className="flex items-center gap-2">
                {(type === "mcq" || type === "true_false") && (
                  <input
                    type={type === "true_false" ? "radio" : "checkbox"}
                    name={type === "true_false" ? "tf-correct" : undefined}
                    checked={o.isCorrect}
                    onChange={(e) => {
                      if (type === "true_false") setSingleCorrect(i);
                      else setOption(i, { isCorrect: e.target.checked });
                    }}
                    className="h-4 w-4"
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
                      className="rounded border border-slate-300 px-1 py-0.5 text-[11px] dark:border-slate-700 dark:bg-slate-900"
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
                      className="w-16 rounded border border-slate-300 px-1 py-0.5 text-[11px] dark:border-slate-700 dark:bg-slate-900"
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
                  className="flex-1 rounded border border-slate-300 px-2 py-1 dark:bg-slate-900 dark:border-slate-700"
                />
                {(type === "mcq" || type === "true_false") && !o.isCorrect && (
                  <select
                    value={o.misconceptionId ?? ""}
                    onChange={(e) =>
                      setOption(i, { misconceptionId: e.target.value || null })
                    }
                    className="rounded border border-slate-300 px-1 py-1 text-[10px] dark:bg-slate-900 dark:border-slate-700"
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
                    className="rounded border border-red-300 px-1 py-0.5 text-[10px] text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
          {type !== "true_false" && (
            <button
              type="button"
              onClick={addOption}
              className="mt-1 text-[11px] text-slate-500 underline"
            >
              + Thêm option
            </button>
          )}
          {(type === "mcq" || type === "true_false") && (
            <button
              type="button"
              onClick={createMisconception}
              className="mt-1 ml-3 text-[11px] text-slate-500 underline"
            >
              + Tạo misconception mới
            </button>
          )}
        </div>
      )}

      {type === "short_answer" && (
        <label className="block">
          <span className="font-medium uppercase text-slate-500">
            Regex chấp nhận thêm (mỗi dòng 1 pattern, optional)
          </span>
          <textarea
            value={acceptedRegexes}
            onChange={(e) => setAcceptedRegexes(e.target.value)}
            rows={2}
            placeholder="^h(e|a)llo$"
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 font-mono text-xs dark:bg-slate-900 dark:border-slate-700"
          />
        </label>
      )}

      <textarea
        value={explanation}
        onChange={(e) => setExplanation(e.target.value)}
        rows={2}
        placeholder="Giải thích (hiện trên result page, optional)"
        className="w-full rounded border border-slate-300 px-2 py-1 dark:bg-slate-900 dark:border-slate-700"
      />

      <div>
        <p className="font-medium uppercase text-slate-500">Tag skills</p>
        <div className="mt-1 flex flex-wrap gap-1">
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
                className={`rounded-full px-2 py-0.5 text-[10px] ${
                  picked
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "border border-slate-300 dark:border-slate-700"
                }`}
              >
                {s.code}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-slate-900 px-3 py-1.5 font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
        >
          {busy ? "..." : "Tạo câu hỏi"}
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="rounded border border-slate-300 px-3 py-1.5 dark:border-slate-700"
        >
          Hủy
        </button>
      </div>
      {error && <p className="text-red-600">Lỗi: {error}</p>}
    </form>
  );
}
