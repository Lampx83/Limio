"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { toast } from "@/lib/toast";

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
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  function validateScore(value: string): string | null {
    if (value.trim() === "") return "Hãy nhập điểm";
    const n = Number(value);
    if (Number.isNaN(n)) return "Điểm phải là số";
    if (n < 0) return "Điểm không thể âm";
    if (n > maxScore) return `Điểm tối đa là ${maxScore}`;
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validateScore(score);
    if (err) {
      setScoreError(err);
      return;
    }
    setBusy(true);
    setServerError(null);
    const res = await fetch(apiUrl(`/api/submissions/${submissionId}/grade`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        score: Number(score),
        feedback: feedback.trim() || null,
      }),
    });
    setBusy(false);
    if (res.ok) {
      toast.success(isGraded ? "Đã cập nhật điểm" : "Đã chấm xong");
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      const msg = d.error ?? "Không lưu được điểm";
      setServerError(msg);
      toast.error(msg);
    }
  }

  const scoreInputId = `grade-score-${submissionId}`;
  const scoreHelpId = `grade-score-help-${submissionId}`;

  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      <div>
        <div className="flex items-center gap-3">
          <label className="label" htmlFor={scoreInputId}>
            Điểm
          </label>
          <input
            id={scoreInputId}
            type="number"
            min={0}
            max={maxScore}
            step="0.1"
            value={score}
            onChange={(e) => {
              setScore(e.target.value);
              if (scoreError) setScoreError(validateScore(e.target.value));
            }}
            onBlur={() => setScoreError(validateScore(score))}
            required
            aria-invalid={!!scoreError}
            aria-describedby={scoreHelpId}
            className={`input w-24 ${
              scoreError ? "border-danger-500 focus:border-danger-500" : ""
            }`}
          />
          <span className="text-xs text-faint">
            / <span className="font-semibold">{maxScore}</span>
          </span>
        </div>
        <p
          id={scoreHelpId}
          className={`help ${scoreError ? "text-danger-600" : ""}`}
        >
          {scoreError ?? `Nhập số từ 0 đến ${maxScore}.`}
        </p>
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
        <button
          type="submit"
          disabled={busy || !!scoreError}
          className="btn-primary btn-sm"
        >
          {busy ? "Đang lưu..." : isGraded ? "Cập nhật điểm" : "✓ Chấm điểm"}
        </button>
        {serverError && (
          <span className="text-xs text-danger-600" role="alert">
            {serverError}
          </span>
        )}
      </div>
    </form>
  );
}
