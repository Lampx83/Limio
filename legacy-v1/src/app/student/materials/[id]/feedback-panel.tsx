"use client";

import { useState } from "react";

export interface MaterialFeedback {
  summary: string;
  strengths: string;
  gaps: string;
  next_steps: string;
  metacog_prompt: string;
}

export default function FeedbackPanel({
  materialId,
  done,
  initialReflection,
  initialFeedback,
}: {
  materialId: number;
  done: boolean;
  initialReflection: string;
  initialFeedback: MaterialFeedback | null;
}) {
  const [reflection, setReflection] = useState(initialReflection);
  const [feedback, setFeedback] = useState<MaterialFeedback | null>(initialFeedback);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/materials/${materialId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reflection }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Sinh phản hồi thất bại");
        return;
      }
      setFeedback(data.feedback);
    } catch {
      setError("Lỗi kết nối, vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  if (!done) {
    return (
      <div className="card p-4 sm:p-5 mt-6 bg-slate-50 dark:bg-slate-800/30 text-sm text-slate-600 text-center">
        Hoàn thành học liệu trước (xem video / đọc xong / nộp quiz) để mở khoá phản hồi AI.
      </div>
    );
  }

  return (
    <div className="card p-4 sm:p-5 mt-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="badge-blue">AI Feedback</span>
        <h3 className="font-semibold text-sm sm:text-base">
          Phản hồi cá nhân hoá theo onboarding của bạn
        </h3>
      </div>

      {!feedback && (
        <>
          <label className="label">Suy ngẫm trước khi xin AI feedback (tuỳ chọn)</label>
          <textarea
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            placeholder="Bạn rút ra được gì? Còn khó khăn ở đâu? (AI sẽ feedback dựa vào câu trả lời này)"
            className="input min-h-[80px] mb-3 text-sm"
          />
          <button
            onClick={generate}
            disabled={loading}
            className="btn-primary w-full sm:w-auto"
          >
            {loading ? "Đang sinh phản hồi..." : "Nhận AI feedback"}
          </button>
          {error && (
            <div className="text-sm text-rose-600 mt-3">{error}</div>
          )}
        </>
      )}

      {feedback && (
        <div className="space-y-3 text-sm">
          <Block tag="Tóm tắt" color="bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-100">
            {feedback.summary}
          </Block>
          <Block tag="Điểm mạnh" color="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
            {feedback.strengths}
          </Block>
          <Block tag="Khoảng trống" color="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
            {feedback.gaps}
          </Block>
          <Block tag="Bước tiếp theo" color="bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200">
            {feedback.next_steps}
          </Block>
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
            <p className="text-xs uppercase font-semibold text-amber-800 mb-1">
              Câu hỏi siêu nhận thức
            </p>
            <p className="italic text-amber-900 dark:text-amber-100">
              {feedback.metacog_prompt}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Block({
  tag,
  color,
  children,
}: {
  tag: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className={`badge ${color} mb-1`}>{tag}</span>
      <p className="mt-1 leading-relaxed whitespace-pre-wrap">{children}</p>
    </div>
  );
}
