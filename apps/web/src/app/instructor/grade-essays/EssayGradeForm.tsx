"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Loader2, AlertTriangle } from "lucide-react";

export default function EssayGradeForm({
  responseId,
  maxScore,
}: {
  responseId: string;
  maxScore: number;
}) {
  const router = useRouter();
  const [score, setScore] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(score);
    if (Number.isNaN(n) || n < 0 || n > maxScore) {
      setError(`Điểm phải trong khoảng 0–${maxScore}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/answer-responses/${responseId}/grade`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ score: n, isCorrect: n >= maxScore }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? `HTTP ${res.status}`);
        setBusy(false);
        return;
      }
      setDone(true);
      // Soft refresh so the graded item disappears from the list.
      setTimeout(() => router.refresh(), 600);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-lg border border-success-200 bg-success-50 px-3 py-2 text-sm text-success-700">
        <CheckCircle2 size={14} /> Đã chấm — đang refresh
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mt-4 flex flex-wrap items-end gap-3 border-t border-token pt-4"
    >
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-faint">
          Điểm (0–{maxScore})
        </span>
        <input
          type="number"
          min={0}
          max={maxScore}
          step={1}
          value={score}
          onChange={(e) => setScore(e.target.value)}
          required
          className="input mt-1 w-24 tabular-nums"
          placeholder={String(maxScore)}
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="btn-primary btn-sm inline-flex items-center gap-1.5 disabled:opacity-50"
      >
        {busy ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <CheckCircle2 size={14} />
        )}
        Lưu điểm
      </button>
      {error && (
        <span className="ml-2 inline-flex items-center gap-1 text-xs text-danger-600">
          <AlertTriangle size={12} /> {error}
        </span>
      )}
    </form>
  );
}
