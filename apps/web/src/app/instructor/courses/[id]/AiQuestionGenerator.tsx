"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface QuestionDraft {
  type: "mcq" | "true_false" | "fill_in";
  prompt: string;
  options: Array<{
    label: string;
    isCorrect: boolean;
    misconceptionHint: string | null;
  }>;
  explanation: string;
  skillCodes: string[];
}

export default function AiQuestionGenerator({
  quizId,
  lessonId,
  nextOrderIndex,
}: {
  quizId: string;
  lessonId: string;
  nextOrderIndex: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(3);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [generating, setGenerating] = useState(false);
  const [drafts, setDrafts] = useState<QuestionDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState<number | null>(null);
  const [imported, setImported] = useState<Set<number>>(new Set());

  async function generate() {
    setGenerating(true);
    setError(null);
    setDrafts([]);
    setImported(new Set());
    const res = await fetch("/api/ai/generate-questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId, count, difficulty }),
    });
    setGenerating(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "ai_failed");
      return;
    }
    const d = await res.json();
    setDrafts(d.drafts ?? []);
  }

  async function importDraft(idx: number) {
    const d = drafts[idx];
    if (!d || imported.has(idx)) return;
    setImporting(idx);
    setError(null);
    const payload = {
      type: d.type,
      prompt: d.prompt,
      points: 1,
      orderIndex: nextOrderIndex + idx,
      explanation: d.explanation || undefined,
      options: d.options.map((o) => ({
        label: o.label,
        isCorrect: o.isCorrect,
      })),
    };
    const res = await fetch(`/api/quizzes/${quizId}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setImporting(null);
    if (res.ok) {
      setImported((prev) => new Set(prev).add(idx));
      router.refresh();
    } else {
      const dt = await res.json().catch(() => ({}));
      setError(`import_failed: ${JSON.stringify(dt.error ?? dt)}`);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded border border-violet-300 px-2 py-1 text-xs text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950/40"
      >
        🪄 AI generate batch
      </button>
    );
  }

  return (
    <div className="w-full rounded-lg border border-violet-300 bg-violet-50 p-3 text-xs dark:border-violet-800 dark:bg-violet-950/30">
      <div className="flex items-center justify-between">
        <p className="font-medium text-violet-800 dark:text-violet-200">
          🪄 AI Question Generator
        </p>
        <button
          onClick={() => setOpen(false)}
          className="text-slate-500 hover:text-slate-800"
        >
          ✕
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="text-slate-500">Số câu</span>
          <input
            type="number"
            min={1}
            max={10}
            value={count}
            onChange={(e) => setCount(Number(e.target.value) || 3)}
            className="ml-1 w-12 rounded border border-slate-300 px-1 py-0.5 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        <label className="block">
          <span className="text-slate-500">Difficulty</span>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as "easy" | "medium" | "hard")}
            className="ml-1 rounded border border-slate-300 px-1 py-0.5 dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="easy">easy</option>
            <option value="medium">medium</option>
            <option value="hard">hard</option>
          </select>
        </label>
        <button
          onClick={generate}
          disabled={generating}
          className="rounded bg-violet-600 px-3 py-1 font-medium text-white disabled:opacity-50 hover:bg-violet-700"
        >
          {generating ? "🪄 ..." : "🪄 Generate"}
        </button>
      </div>

      {error && <p className="mt-2 text-red-600">Lỗi: {error}</p>}

      {drafts.length > 0 && (
        <ul className="mt-3 space-y-3">
          {drafts.map((d, i) => (
            <li
              key={i}
              className="rounded border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-baseline justify-between">
                <p className="text-[11px] uppercase text-slate-500">
                  {d.type} · {d.options.length} options
                  {d.skillCodes.length > 0 && (
                    <> · skills: {d.skillCodes.join(", ")}</>
                  )}
                </p>
                <button
                  onClick={() => importDraft(i)}
                  disabled={importing === i || imported.has(i)}
                  className="rounded bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
                >
                  {imported.has(i) ? "✓ Đã import" : importing === i ? "..." : "Import"}
                </button>
              </div>
              <p className="mt-1 whitespace-pre-wrap font-medium">{d.prompt}</p>
              <ul className="mt-1 space-y-0.5">
                {d.options.map((o, oi) => (
                  <li key={oi} className="flex items-start gap-1">
                    <span
                      className={
                        o.isCorrect
                          ? "text-emerald-600"
                          : "text-slate-400"
                      }
                    >
                      {o.isCorrect ? "✓" : "·"}
                    </span>
                    <span className="flex-1">{o.label}</span>
                    {o.misconceptionHint && (
                      <span className="text-[10px] italic text-amber-700 dark:text-amber-300">
                        ↳ {o.misconceptionHint}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {d.explanation && (
                <p className="mt-1 text-[11px] italic text-slate-600 dark:text-slate-400">
                  Giải thích: {d.explanation}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
