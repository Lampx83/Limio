"use client";

import { useState } from "react";
import FeedbackPanel, { type MaterialFeedback } from "./feedback-panel";

interface QuizQuestion {
  q: string;
  options: string[];
  correct_idx: number;
  explanation?: string;
}
interface QuizDetail {
  q: string;
  chosen_text: string;
  correct_text: string;
  is_correct: boolean;
  explanation?: string;
}

export default function QuizMaterial({
  materialId,
  quizData,
  initialScore,
  initialDetail,
  initialReflection,
  initialFeedback,
}: {
  materialId: number;
  quizData: QuizQuestion[];
  initialScore: number | null;
  initialDetail: QuizDetail[] | null;
  initialReflection: string;
  initialFeedback: MaterialFeedback | null;
}) {
  const [answers, setAnswers] = useState<(number | null)[]>(
    initialDetail
      ? initialDetail.map((d) =>
          quizData.find((q, i) => q.q === d.q)
            ? quizData[initialDetail.indexOf(d)]?.options.indexOf(d.chosen_text) ?? null
            : null,
        )
      : Array(quizData.length).fill(null),
  );
  const [submitted, setSubmitted] = useState(initialScore !== null);
  const [score, setScore] = useState<number | null>(initialScore);
  const [detail, setDetail] = useState<QuizDetail[] | null>(initialDetail);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allAnswered = answers.every((a) => a !== null);

  function setAnswer(qIdx: number, optIdx: number) {
    if (submitted) return;
    const next = [...answers];
    next[qIdx] = optIdx;
    setAnswers(next);
  }

  async function submit() {
    setError(null);
    if (!allAnswered) {
      setError("Vui lòng trả lời hết các câu.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/materials/${materialId}/interaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quiz_answers: answers }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Nộp quiz thất bại");
        return;
      }
      setSubmitted(true);
      setScore(data.score);
      setDetail(data.detail);
    } catch {
      setError("Lỗi kết nối, vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="card p-4 sm:p-6">
        {submitted && score !== null && (
          <div className="mb-5 flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-sm text-slate-500">Điểm của bạn</p>
              <p className="text-2xl sm:text-3xl font-bold text-brand-700 dark:text-brand-200">
                {score}/100
              </p>
            </div>
            <span className="badge-green">✓ Đã nộp</span>
          </div>
        )}

        <ol className="space-y-5">
          {quizData.map((q, qIdx) => {
            const d = detail?.[qIdx];
            return (
              <li key={qIdx}>
                <p className="font-medium mb-2 text-sm sm:text-base">
                  <span className="text-slate-400 mr-1">{qIdx + 1}.</span>
                  {q.q}
                </p>
                <div className="space-y-2">
                  {q.options.map((opt, optIdx) => {
                    const chosen = answers[qIdx] === optIdx;
                    let cls =
                      "border-slate-300 dark:border-slate-700 hover:border-brand-400";
                    if (submitted && d) {
                      if (optIdx === q.correct_idx)
                        cls = "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20";
                      else if (chosen && !d.is_correct)
                        cls = "border-rose-500 bg-rose-50 dark:bg-rose-900/20";
                      else cls = "border-slate-300 dark:border-slate-700 opacity-60";
                    } else if (chosen) {
                      cls = "border-brand-600 bg-brand-50 dark:bg-brand-900/20";
                    }
                    return (
                      <button
                        key={optIdx}
                        type="button"
                        onClick={() => setAnswer(qIdx, optIdx)}
                        disabled={submitted}
                        className={`w-full text-left text-sm sm:text-base px-3 py-2 rounded border-2 transition ${cls}`}
                      >
                        <span className="font-mono text-xs text-slate-400 mr-2">
                          {String.fromCharCode(65 + optIdx)}.
                        </span>
                        {opt}
                      </button>
                    );
                  })}
                </div>
                {submitted && d && (
                  <p
                    className={`mt-2 text-xs sm:text-sm ${
                      d.is_correct
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-rose-700 dark:text-rose-300"
                    }`}
                  >
                    {d.is_correct ? "✓ Đúng. " : "✗ Sai. "}
                    {d.explanation}
                  </p>
                )}
              </li>
            );
          })}
        </ol>

        {!submitted && (
          <>
            {error && (
              <div className="text-sm text-rose-600 mt-4">{error}</div>
            )}
            <div className="mt-5">
              <button
                onClick={submit}
                disabled={!allAnswered || submitting}
                className="btn-primary w-full sm:w-auto disabled:opacity-50"
              >
                {submitting ? "Đang nộp..." : "Nộp quiz"}
              </button>
            </div>
          </>
        )}
      </div>

      <FeedbackPanel
        materialId={materialId}
        done={submitted}
        initialReflection={initialReflection}
        initialFeedback={initialFeedback}
      />
    </>
  );
}
