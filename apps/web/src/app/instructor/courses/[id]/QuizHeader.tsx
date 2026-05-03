"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Quiz {
  id: string;
  title: string;
  difficulty: number | null;
  passThresholdPct: number;
  requireConfidence: boolean;
  timeLimitSec: number | null;
  maxAttempts: number | null;
}

export default function QuizHeader({ quiz }: { quiz: Quiz }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(quiz.title);
  const [difficulty, setDifficulty] = useState(quiz.difficulty ?? 1);
  const [passThresholdPct, setPassThresholdPct] = useState(quiz.passThresholdPct);
  const [requireConfidence, setRequireConfidence] = useState(quiz.requireConfidence);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch(`/api/quizzes/${quiz.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, difficulty, passThresholdPct, requireConfidence }),
    });
    setBusy(false);
    if (res.ok) {
      setEditing(false);
      router.refresh();
    }
  }

  async function remove() {
    if (!confirm(`Xóa quiz "${quiz.title}"? Cascade questions, options, attempts.`)) return;
    setBusy(true);
    const res = await fetch(`/api/quizzes/${quiz.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  if (editing) {
    return (
      <form onSubmit={save} className="space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="w-full rounded border border-slate-300 px-2 py-1 dark:bg-slate-900 dark:border-slate-700"
        />
        <div className="flex gap-2">
          <label>
            difficulty:
            <input
              type="number"
              min={1}
              max={5}
              value={difficulty}
              onChange={(e) => setDifficulty(Number(e.target.value))}
              className="ml-1 w-14 rounded border border-slate-300 px-1 py-0.5 dark:bg-slate-900 dark:border-slate-700"
            />
          </label>
          <label>
            pass%:
            <input
              type="number"
              min={0}
              max={100}
              value={passThresholdPct}
              onChange={(e) => setPassThresholdPct(Number(e.target.value))}
              className="ml-1 w-14 rounded border border-slate-300 px-1 py-0.5 dark:bg-slate-900 dark:border-slate-700"
            />
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={requireConfidence}
              onChange={(e) => setRequireConfidence(e.target.checked)}
            />
            confidence
          </label>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-slate-900 px-2 py-1 font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
          >
            Lưu
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded border border-slate-300 px-2 py-1 dark:border-slate-700"
          >
            Hủy
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex justify-end gap-1">
      <button
        onClick={() => setEditing(true)}
        className="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
      >
        Sửa quiz
      </button>
      <button
        onClick={remove}
        disabled={busy}
        className="rounded border border-red-300 px-2 py-0.5 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
      >
        Xóa quiz
      </button>
    </div>
  );
}
