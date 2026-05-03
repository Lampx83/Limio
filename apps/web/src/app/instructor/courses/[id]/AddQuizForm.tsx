"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AddQuizForm({ lessonId }: { lessonId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState(1);
  const [passThresholdPct, setPassThresholdPct] = useState(70);
  const [requireConfidence, setRequireConfidence] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-slate-500 underline hover:text-slate-700 dark:hover:text-slate-300"
      >
        + Thêm quiz
      </button>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch(`/api/lessons/${lessonId}/quizzes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        difficulty,
        passThresholdPct,
        requireConfidence,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setTitle("");
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-2 rounded border border-slate-300 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-900/40"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        placeholder="Tên quiz"
        autoFocus
        className="w-full rounded border border-slate-300 px-2 py-1 text-sm dark:bg-slate-900 dark:border-slate-700"
      />
      <div className="flex gap-2">
        <label className="block">
          <span className="text-slate-500">Difficulty (1-5)</span>
          <input
            type="number"
            min={1}
            max={5}
            value={difficulty}
            onChange={(e) => setDifficulty(Number(e.target.value))}
            className="ml-1 w-14 rounded border border-slate-300 px-1 py-0.5 dark:bg-slate-900 dark:border-slate-700"
          />
        </label>
        <label className="block">
          <span className="text-slate-500">Pass %</span>
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
          <span>Yêu cầu confidence</span>
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-slate-900 px-2 py-1 font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
        >
          {busy ? "..." : "Tạo quiz"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded border border-slate-300 px-2 py-1 dark:border-slate-700"
        >
          Hủy
        </button>
      </div>
    </form>
  );
}
