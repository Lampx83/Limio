"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function GradeForm({
  submissionId,
  maxScore,
  initialScore,
  initialFeedback,
  isGraded,
}: {
  submissionId: string;
  maxScore: number;
  initialScore: number | null;
  initialFeedback: string | null;
  isGraded: boolean;
}) {
  const router = useRouter();
  const [score, setScore] = useState(
    initialScore !== null ? String(initialScore) : "",
  );
  const [feedback, setFeedback] = useState(initialFeedback ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/submissions/${submissionId}/grade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        score: Number(score),
        feedback: feedback.trim() || null,
      }),
    });
    setBusy(false);
    if (res.ok) router.refresh();
    else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "grade_failed");
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-2 rounded border border-slate-300 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-500">Điểm</label>
        <input
          type="number"
          min={0}
          max={maxScore}
          value={score}
          onChange={(e) => setScore(e.target.value)}
          required
          className="w-24 rounded border border-slate-300 px-2 py-1 dark:bg-slate-900 dark:border-slate-700"
        />
        <span className="text-xs text-slate-500">/ {maxScore}</span>
      </div>
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        rows={3}
        placeholder="Nhận xét (optional)..."
        className="w-full rounded border border-slate-300 px-2 py-1 text-xs dark:bg-slate-900 dark:border-slate-700"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-slate-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
        >
          {busy ? "..." : isGraded ? "Cập nhật điểm" : "Chấm điểm"}
        </button>
        {error && <span className="text-xs text-red-600">Lỗi: {error}</span>}
      </div>
    </form>
  );
}
