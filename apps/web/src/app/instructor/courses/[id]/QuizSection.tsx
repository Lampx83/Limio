"use client";

import { useState } from "react";
import { QuizActionButtons, QuizEditForm } from "./QuizHeader";
import QuestionRow from "./QuestionRow";
import AddQuestionForm from "./AddQuestionForm";
import AiQuestionGenerator from "./AiQuestionGenerator";
import BulkImportQuestions from "./BulkImportQuestions";

interface Quiz {
  id: string;
  title: string;
  difficulty: number | null;
  requireConfidence: boolean;
  timeLimitSec: number | null;
  maxAttempts: number | null;
  isHidden: boolean;
  questions: Array<{
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
  }>;
}

export default function QuizSection({
  quiz,
  lessonId,
}: {
  quiz: Quiz;
  lessonId: string;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <details className={`group overflow-hidden rounded-xl border transition-colors ${
      quiz.isHidden
        ? 'border-danger-200 bg-danger-50/50'
        : 'border-token bg-[rgb(var(--surface))] hover:border-brand-200'
    }`}>
      <summary className="flex flex-wrap items-center gap-2 cursor-pointer px-3 py-2.5 hover:bg-[rgb(var(--surface-muted))/0.5] transition-colors">
        <span className="text-lg" aria-hidden></span>
        <span className="text-sm font-semibold">{quiz.title}</span>
        <span className="ml-auto text-sm text-muted">
          {quiz.questions.length} câu · diff {quiz.difficulty ?? "—"}
        </span>
        <QuizActionButtons quiz={quiz} onEdit={() => setEditing(true)} />
        <span className="text-xs text-faint opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden>
          ▾
        </span>
      </summary>
      <div className="border-t border-token px-4 py-3 space-y-3">
        {editing && (
          <QuizEditForm quiz={quiz} onClose={() => setEditing(false)} />
        )}

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">
            Câu hỏi ({quiz.questions.length})
          </p>
          <ol className="space-y-2">
            {quiz.questions.map((q, i) => (
              <li key={q.id}>
                <QuestionRow question={q} order={i + 1} />
              </li>
            ))}
          </ol>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-token pt-3">
          <AddQuestionForm
            quizId={quiz.id}
            nextOrderIndex={quiz.questions.length}
          />
          <AiQuestionGenerator
            quizId={quiz.id}
            lessonId={lessonId}
            nextOrderIndex={quiz.questions.length}
          />
          <BulkImportQuestions quizId={quiz.id} />
        </div>
      </div>
    </details>
  );
}
