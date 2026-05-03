"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Question {
  id: string;
  type: string;
  prompt: string;
  points: number;
  orderIndex: number;
  explanation: string | null;
  options: Array<{
    id: string;
    label: string;
    isCorrect: boolean;
    orderIndex: number;
    misconceptionId: string | null;
    misconception: { id: string; code: string; name: string } | null;
  }>;
  skillTags: Array<{
    skillId: string;
    skill: { code: string; name: string };
  }>;
}

export default function QuestionRow({
  question,
  order,
}: {
  question: Question;
  order: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm(`Xóa câu hỏi "${question.prompt.slice(0, 50)}..."?`)) return;
    setBusy(true);
    const res = await fetch(`/api/questions/${question.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return (
    <div className="rounded border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p>
            <span className="font-mono text-slate-500">Câu {order}</span>
            <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] uppercase dark:bg-slate-800">
              {question.type}
            </span>
            <span className="ml-2 text-slate-500">{question.points} điểm</span>
          </p>
          <p className="mt-1 whitespace-pre-wrap">{question.prompt}</p>
          <ul className="mt-1 ml-4 space-y-0.5 text-[11px]">
            {question.options.map((o) => (
              <li key={o.id}>
                <span
                  className={
                    o.isCorrect
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-slate-600 dark:text-slate-400"
                  }
                >
                  {o.isCorrect ? "✓" : "·"} {o.label}
                </span>
                {o.misconception && (
                  <span className="ml-2 rounded bg-amber-100 px-1 text-[10px] text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
                    {o.misconception.code}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {question.skillTags.length > 0 && (
            <p className="mt-1 text-[11px] text-slate-500">
              Skills: {question.skillTags.map((t) => t.skill.code).join(", ")}
            </p>
          )}
          {question.explanation && (
            <p className="mt-1 italic text-[11px] text-slate-500">
              💡 {question.explanation}
            </p>
          )}
        </div>
        <button
          onClick={remove}
          disabled={busy}
          className="rounded border border-red-300 px-1.5 py-0.5 text-[10px] text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
        >
          Xóa
        </button>
      </div>
    </div>
  );
}
