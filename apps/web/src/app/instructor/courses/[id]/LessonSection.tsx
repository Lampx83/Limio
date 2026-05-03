import LessonHeader from "./LessonHeader";
import ContentItemsList from "./ContentItemsList";
import AddContentItemForm from "./AddContentItemForm";
import SkillTagsEditor from "./SkillTagsEditor";
import QuizSection from "./QuizSection";
import AddQuizForm from "./AddQuizForm";
import AssignmentSection from "./AssignmentSection";
import AddAssignmentForm from "./AddAssignmentForm";

interface Lesson {
  id: string;
  title: string;
  description: string | null;
  orderIndex: number;
  contentItems: Array<{
    id: string;
    type: string;
    payload: unknown;
    orderIndex: number;
  }>;
  skillTags: Array<{
    id: string;
    skillId: string;
    skill: { code: string; name: string };
  }>;
  assignments: Array<{
    id: string;
    title: string;
    description: string;
    dueAt: Date | null;
    maxScore: number;
  }>;
  quizzes: Array<{
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
  }>;
}

export default function LessonSection({
  lesson,
  order,
}: {
  lesson: Lesson;
  order: number;
}) {
  return (
    <details
      open
      className="rounded-md border border-slate-200 bg-slate-50/40 dark:border-slate-800 dark:bg-slate-900/20"
    >
      <summary className="cursor-pointer px-3 py-2 text-sm">
        <span className="font-medium">
          Lesson {order}: {lesson.title}
        </span>
        {lesson.skillTags.length === 0 && (
          <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
            chưa tag skill
          </span>
        )}
        <span className="ml-2 text-xs text-slate-500">
          · {lesson.contentItems.length} content · {lesson.quizzes.length} quiz ·{" "}
          {lesson.assignments.length} assignment
        </span>
      </summary>
      <div className="border-t border-slate-200 px-3 py-3 dark:border-slate-800">
        <LessonHeader
          lessonId={lesson.id}
          title={lesson.title}
          description={lesson.description}
          orderIndex={lesson.orderIndex}
        />

        <div className="mt-3">
          <p className="text-xs font-medium uppercase text-slate-500">Skills</p>
          <SkillTagsEditor
            lessonId={lesson.id}
            tags={lesson.skillTags.map((t) => ({
              skillId: t.skillId,
              code: t.skill.code,
              name: t.skill.name,
            }))}
          />
        </div>

        <div className="mt-3">
          <p className="text-xs font-medium uppercase text-slate-500">
            Nội dung ({lesson.contentItems.length})
          </p>
          <ContentItemsList items={lesson.contentItems} />
          <div className="mt-2">
            <AddContentItemForm
              lessonId={lesson.id}
              nextOrderIndex={lesson.contentItems.length}
            />
          </div>
        </div>

        <div className="mt-4">
          <p className="text-xs font-medium uppercase text-slate-500">
            Quizzes ({lesson.quizzes.length})
          </p>
          <ol className="mt-1 space-y-2">
            {lesson.quizzes.map((q) => (
              <li key={q.id}>
                <QuizSection quiz={q} lessonId={lesson.id} />
              </li>
            ))}
          </ol>
          <div className="mt-2">
            <AddQuizForm lessonId={lesson.id} />
          </div>
        </div>

        <div className="mt-4">
          <p className="text-xs font-medium uppercase text-slate-500">
            Assignments ({lesson.assignments.length})
          </p>
          <ol className="mt-1 space-y-2">
            {lesson.assignments.map((a) => (
              <li key={a.id}>
                <AssignmentSection assignment={a} />
              </li>
            ))}
          </ol>
          <div className="mt-2">
            <AddAssignmentForm lessonId={lesson.id} />
          </div>
        </div>
      </div>
    </details>
  );
}
