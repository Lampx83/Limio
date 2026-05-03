import QuizHeader from "./QuizHeader";
import QuestionRow from "./QuestionRow";
import AddQuestionForm from "./AddQuestionForm";
import AiQuestionGenerator from "./AiQuestionGenerator";
import BulkImportQuestions from "./BulkImportQuestions";

interface Quiz {
  id: string;
  title: string;
  difficulty: number | null;
  passThresholdPct: number;
  requireConfidence: boolean;
  timeLimitSec: number | null;
  maxAttempts: number | null;
  questions: Array<{
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
  }>;
}

export default function QuizSection({
  quiz,
  lessonId,
}: {
  quiz: Quiz;
  lessonId: string;
}) {
  return (
    <details className="group overflow-hidden rounded-xl border border-token bg-[rgb(var(--surface))] transition-colors hover:border-brand-200">
      <summary className="flex flex-wrap items-center gap-2 cursor-pointer px-3 py-2.5 hover:bg-[rgb(var(--surface-muted))/0.5] transition-colors">
        <span className="text-lg" aria-hidden></span>
        <span className="text-sm font-semibold">{quiz.title}</span>
        <span className="ml-auto text-sm text-muted">
          {quiz.questions.length} câu · diff {quiz.difficulty ?? "—"} · pass{" "}
          {quiz.passThresholdPct}%
        </span>
        <span className="text-xs text-faint opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden>
          ▾
        </span>
      </summary>
      <div className="border-t border-token px-4 py-3 space-y-3">
        <QuizHeader quiz={quiz} />

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
