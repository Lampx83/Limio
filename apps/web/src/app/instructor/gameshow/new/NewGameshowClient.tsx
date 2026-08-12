"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/apiUrl";

type QuizOption = {
  id: string;
  title: string;
  courseTitle: string;
  questionCount: number;
};

export default function NewGameshowClient({ quizzes }: { quizzes: QuizOption[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string>(quizzes[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onCreate = async () => {
    if (!selected) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(apiUrl("/api/gameshow/sessions/create"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ quizId: selected }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      const j = (await r.json()) as { id: string };
      router.push(`/instructor/gameshow/${j.id}`);
    } finally {
      setBusy(false);
    }
  };

  if (quizzes.length === 0) {
    return (
      <div className="mt-6 rounded border border-dashed border-default p-6 text-center text-sm text-faint">
        Chưa có quiz nào có câu trắc nghiệm/đúng-sai. Tạo quiz với ít nhất 1 câu loại này trước.
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="space-y-2">
        {quizzes.map((q) => (
          <label
            key={q.id}
            className={`flex cursor-pointer items-center justify-between rounded border p-3 ${
              selected === q.id ? "border-blue-500 bg-blue-50" : "border-default bg-white"
            }`}
          >
            <span>
              <span className="block text-sm font-medium">{q.title}</span>
              <span className="block text-xs text-faint">
                {q.courseTitle} · {q.questionCount} câu hỏi
              </span>
            </span>
            <input
              type="radio"
              name="quiz"
              checked={selected === q.id}
              onChange={() => setSelected(q.id)}
            />
          </label>
        ))}
      </div>

      {err && (
        <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          ⚠ {err}
        </div>
      )}

      <button
        onClick={onCreate}
        disabled={busy || !selected}
        className="w-full rounded bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {busy ? "Đang tạo..." : "🚀 Tạo phiên"}
      </button>
    </div>
  );
}
