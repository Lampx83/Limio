"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PeerReviewForm({
  peerReviewId,
  status,
  initialContent,
  initialScore,
}: {
  peerReviewId: number;
  status: string;
  initialContent: string;
  initialScore: number | null;
}) {
  const router = useRouter();
  const [content, setContent] = useState(initialContent);
  const [score, setScore] = useState<number>(initialScore ?? 70);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === "submitted") {
    return (
      <div className="card p-4 sm:p-5 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300">
        <p className="text-emerald-800 dark:text-emerald-100 font-medium mb-2">
          ✓ Bạn đã nộp peer review này
        </p>
        <p className="text-sm whitespace-pre-wrap">{initialContent}</p>
        {initialScore !== null && (
          <p className="text-sm font-semibold mt-2">
            Điểm: {initialScore}/100
          </p>
        )}
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/peer-reviews/${peerReviewId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, score }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error ?? "Nộp thất bại");
        return;
      }
      router.push("/student/peer-reviews");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-4 sm:p-5 space-y-3">
      <h3 className="font-semibold">Nhận xét peer review</h3>
      <p className="text-xs text-slate-500">
        Hãy nhận xét xây dựng dựa trên rubric. Tránh nhận xét cá nhân ("em giỏi/yếu").
        Tập trung vào nội dung, lập luận, cách trình bày.
      </p>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="input min-h-[160px] text-sm"
        placeholder="Nhận xét chi tiết (≥ 30 ký tự)..."
        required
        minLength={30}
      />
      <div>
        <label className="label">Điểm (0-100)</label>
        <input
          type="number"
          className="input"
          value={score}
          onChange={(e) => setScore(Number(e.target.value))}
          min={0}
          max={100}
          required
        />
      </div>
      {error && <div className="text-sm text-rose-600">{error}</div>}
      <div className="flex justify-end">
        <button disabled={submitting} className="btn-primary">
          {submitting ? "Đang nộp..." : "Nộp peer review"}
        </button>
      </div>
    </form>
  );
}
