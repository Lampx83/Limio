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
    <details className="rounded border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40">
      <summary className="cursor-pointer px-3 py-2 text-sm">
        📝 <span className="font-medium">{quiz.title}</span>
        <span className="ml-2 text-xs text-slate-500">
          {quiz.questions.length} câu · difficulty {quiz.difficulty ?? "—"} · pass{" "}
          {quiz.passThresholdPct}%
        </span>
      </summary>
      <div className="border-t border-slate-200 px-3 py-2 text-xs dark:border-slate-800">
        <QuizHeader quiz={quiz} />

        <p className="mt-3 font-medium uppercase text-slate-500">
          Câu hỏi ({quiz.questions.length})
        </p>
        <ol className="mt-1 space-y-2">
          {quiz.questions.map((q, i) => (
            <li key={q.id}>
              <QuestionRow question={q} order={i + 1} />
            </li>
          ))}
        </ol>

        <div className="mt-3 flex flex-wrap items-center gap-3">
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
