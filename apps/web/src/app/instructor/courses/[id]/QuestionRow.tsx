"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import EditQuestionForm from "./EditQuestionForm";

interface Question {
  id: string;
  type: string;
  prompt: string;
  points: number;
  orderIndex: number;
  explanation: string | null;
  extra: unknown;
  options: Array<{
    id: string;
    label: string;
    isCorrect: boolean;
    orderIndex: number;
    misconceptionId: string | null;
    misconception: { id: string; code: string; name: string } | null;
    extra: unknown;
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
  const [editing, setEditing] = useState(false);

  async function remove() {
    if (!confirm(`Xóa câu hỏi "${question.prompt.slice(0, 50)}..."?`)) return;
    setBusy(true);
    const res = await fetch(`/api/questions/${question.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  if (editing) {
    return (
      <EditQuestionForm
        question={question}
        onClose={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="rounded-xl border border-token bg-[rgb(var(--surface))] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand-700 tabular-nums">
              {order}
            </span>
            <span className="chip">{question.type}</span>
            <span className="text-xs text-faint">{question.points} điểm</span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm">{question.prompt}</p>
          <ul className="mt-2 space-y-0.5 pl-1 text-xs">
            {question.options.map((o) => (
              <li key={o.id} className="flex items-center gap-1.5">
                <span
                  className={
                    o.isCorrect ? "font-semibold text-success-700" : "text-muted"
                  }
                >
                  {o.isCorrect ? "✓" : "·"} {o.label}
                </span>
                {o.misconception && (
                  <span className="chip-accent">{o.misconception.code}</span>
                )}
              </li>
            ))}
          </ul>
          {question.skillTags.length > 0 && (
            <p className="mt-2 text-xs text-faint">
              Skills:{" "}
              <span className="font-mono">
                {question.skillTags.map((t) => t.skill.code).join(", ")}
              </span>
            </p>
          )}
          {question.explanation && (
            <p className="mt-2 rounded-md bg-[rgb(var(--surface-muted))] px-2 py-1 text-xs italic text-muted">
              {question.explanation}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={() => setEditing(true)}
            className="btn-sm inline-flex items-center justify-center gap-1 rounded-lg border border-token bg-[rgb(var(--surface))] px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:border-brand-200 hover:bg-brand-soft hover:text-brand-700"
          >
            Sửa
          </button>
          <button
            onClick={remove}
            disabled={busy}
            className="btn-sm inline-flex items-center justify-center gap-1 rounded-lg border border-danger-100 bg-[rgb(var(--surface))] px-2.5 py-1 text-xs font-medium text-danger-600 transition-colors hover:bg-danger-50 disabled:opacity-50"
          >
            Xóa
          </button>
        </div>
      </div>
    </div>
  );
}
