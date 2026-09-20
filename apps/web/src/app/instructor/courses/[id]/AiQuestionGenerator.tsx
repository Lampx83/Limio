"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

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
    const res = await fetch(apiUrl("/api/ai/generate-questions"), {
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
      explanation: d.explanation || undefined,
      options: d.options.map((o) => ({
        label: o.label,
        isCorrect: o.isCorrect,
      })),
    };
    const res = await fetch(apiUrl(`/api/quizzes/${quizId}/questions`), {
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
        className="btn-sm inline-flex items-center justify-center gap-2 rounded-lg border border-brand-200 bg-brand-soft px-3 py-1.5 font-medium text-brand-700 transition-colors hover:bg-brand-100"
      >
        AI generate batch
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-brand-200 bg-brand-soft p-3 text-xs">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-brand-700">AI Question Generator</p>
        <button
          onClick={() => setOpen(false)}
          className="text-faint hover:text-[rgb(var(--text))]"
          aria-label="Đóng"
        >
          ✕
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-faint">Số câu</span>
          <input
            type="number"
            min={1}
            max={10}
            value={count}
            onChange={(e) => setCount(Number(e.target.value) || 3)}
            className="input ml-2 w-16"
          />
        </label>
        <label className="block">
          <span className="text-faint">Difficulty</span>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as "easy" | "medium" | "hard")}
            className="select ml-2 w-28"
          >
            <option value="easy">easy</option>
            <option value="medium">medium</option>
            <option value="hard">hard</option>
          </select>
        </label>
        <button
          onClick={generate}
          disabled={generating}
          className="btn-sm inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-1.5 font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
        >
          {generating ? "..." : "Generate"}
        </button>
      </div>

      {error && <p className="mt-2 text-danger-600">Lỗi: {error}</p>}

      {drafts.length > 0 && (
        <ul className="mt-3 space-y-2">
          {drafts.map((d, i) => (
            <li
              key={i}
              className="rounded-lg border border-token bg-[rgb(var(--surface))] p-3"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-faint">
                  <span className="chip mr-1">{d.type}</span>
                  <span>{d.options.length} options</span>
                  {d.skillCodes.length > 0 && (
                    <> · skills: {d.skillCodes.join(", ")}</>
                  )}
                </p>
                <button
                  onClick={() => importDraft(i)}
                  disabled={importing === i || imported.has(i)}
                  className={`btn-sm shrink-0 inline-flex items-center justify-center gap-2 rounded-lg px-2.5 py-1 font-medium transition-colors disabled:opacity-50 ${
                    imported.has(i)
                      ? "bg-success-50 text-success-700"
                      : "bg-brand-600 text-white hover:bg-brand-700"
                  }`}
                >
                  {imported.has(i) ? "✓ Đã import" : importing === i ? "..." : "Import"}
                </button>
              </div>
              <p className="mt-2 whitespace-pre-wrap font-medium">{d.prompt}</p>
              <ul className="mt-2 space-y-0.5">
                {d.options.map((o, oi) => (
                  <li key={oi} className="flex items-start gap-1.5">
                    <span
                      className={
                        o.isCorrect ? "text-success-600" : "text-faint"
                      }
                    >
                      {o.isCorrect ? "✓" : "·"}
                    </span>
                    <span className="flex-1">{o.label}</span>
                    {o.misconceptionHint && (
                      <span className="italic text-accent-700">
                        ↳ {o.misconceptionHint}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {d.explanation && (
                <p className="mt-2 italic text-faint">
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
