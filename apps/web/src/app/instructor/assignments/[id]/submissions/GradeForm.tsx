"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

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
    const res = await fetch(apiUrl(`/api/submissions/${submissionId}/grade`), {
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
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="flex items-center gap-3">
        <label className="label" htmlFor={`grade-score-${submissionId}`}>
          Điểm
        </label>
        <input
          id={`grade-score-${submissionId}`}
          type="number"
          min={0}
          max={maxScore}
          value={score}
          onChange={(e) => setScore(e.target.value)}
          required
          className="input w-24"
        />
        <span className="text-xs text-faint">
          / <span className="font-semibold">{maxScore}</span>
        </span>
      </div>
      <div>
        <label className="label" htmlFor={`grade-fb-${submissionId}`}>
          Nhận xét
        </label>
        <textarea
          id={`grade-fb-${submissionId}`}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={3}
          placeholder="Nhận xét cho học viên (optional)..."
          className="textarea mt-1.5"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={busy} className="btn-primary btn-sm">
          {busy ? "..." : isGraded ? "Cập nhật điểm" : "✓ Chấm điểm"}
        </button>
        {error && (
          <span className="text-xs text-danger-600">Lỗi: {error}</span>
        )}
      </div>
    </form>
  );
}
