"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SRLQuestion } from "@/lib/srl-questions";

export default function SRLForm({ questions }: { questions: SRLQuestion[] }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const allDone = questions.every((q) => typeof answers[q.id] === "number");

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/srl?phase=post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Lưu thất bại");
        return;
      }
      router.push("/student?completed=1");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <ol className="space-y-5">
        {questions.map((q, idx) => (
          <li key={q.id}>
            <p className="font-medium mb-2 text-sm sm:text-base">
              {idx + 1}. {q.text}
            </p>
            <div className="flex gap-2 flex-wrap">
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() =>
                    setAnswers((prev) => ({ ...prev, [q.id]: v }))
                  }
                  className={`w-11 h-11 rounded-full border-2 font-medium transition ${
                    answers[q.id] === v
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-slate-300 dark:border-slate-700 hover:border-brand-400"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ol>
      {error && <div className="text-sm text-rose-600 mt-4">{error}</div>}
      <button
        onClick={submit}
        disabled={!allDone || submitting}
        className="btn-primary mt-5 w-full sm:w-auto disabled:opacity-50"
      >
        {submitting ? "Đang lưu..." : "Hoàn tất bảng hỏi"}
      </button>
    </>
  );
}
