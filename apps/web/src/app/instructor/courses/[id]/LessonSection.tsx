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
  const noSkill = lesson.skillTags.length === 0;
  return (
    <details
      open
      className="overflow-hidden rounded-xl border border-token bg-[rgb(var(--surface))]"
    >
      <summary className="flex flex-wrap items-center gap-2 cursor-pointer px-4 py-3 hover:bg-[rgb(var(--surface-muted))/0.5] transition-colors">
        <span className="text-base font-semibold">
          <span className="mr-2 text-sm font-normal text-faint">Lesson {order}</span>
          {lesson.title}
        </span>
        {noSkill && <span className="chip-accent">⚠️ chưa tag skill</span>}
        <span className="ml-auto text-sm text-muted">
          {lesson.contentItems.length} content · {lesson.quizzes.length} quiz ·{" "}
          {lesson.assignments.length} assignment
        </span>
      </summary>
      <div className="border-t border-token px-4 py-4 space-y-5">
        <LessonHeader
          lessonId={lesson.id}
          title={lesson.title}
          description={lesson.description}
          orderIndex={lesson.orderIndex}
        />

        <SubSection label="Skills">
          <SkillTagsEditor
            lessonId={lesson.id}
            tags={lesson.skillTags.map((t) => ({
              skillId: t.skillId,
              code: t.skill.code,
              name: t.skill.name,
            }))}
          />
        </SubSection>

        <SubSection label={`Nội dung (${lesson.contentItems.length})`}>
          <ContentItemsList items={lesson.contentItems} />
          <div className="mt-2">
            <AddContentItemForm
              lessonId={lesson.id}
              nextOrderIndex={lesson.contentItems.length}
            />
          </div>
        </SubSection>

        <SubSection label={`Quizzes (${lesson.quizzes.length})`}>
          {lesson.quizzes.length === 0 ? (
            <p className="mb-2 rounded-lg border border-dashed border-token bg-[rgb(var(--surface-muted))/0.5] px-3 py-3 text-center text-sm text-muted">
              Chưa có quiz nào — tạo quiz để kiểm tra hiểu biết của học viên.
            </p>
          ) : (
            <ol className="space-y-2">
              {lesson.quizzes.map((q) => (
                <li key={q.id}>
                  <QuizSection quiz={q} lessonId={lesson.id} />
                </li>
              ))}
            </ol>
          )}
          <div className="mt-2">
            <AddQuizForm lessonId={lesson.id} />
          </div>
        </SubSection>

        <SubSection label={`Assignments (${lesson.assignments.length})`}>
          {lesson.assignments.length === 0 ? (
            <p className="mb-2 rounded-lg border border-dashed border-token bg-[rgb(var(--surface-muted))/0.5] px-3 py-3 text-center text-sm text-muted">
              Chưa có assignment nào — bài tập sẽ được instructor chấm tay.
            </p>
          ) : (
            <ol className="space-y-2">
              {lesson.assignments.map((a) => (
                <li key={a.id}>
                  <AssignmentSection assignment={a} />
                </li>
              ))}
            </ol>
          )}
          <div className="mt-2">
            <AddAssignmentForm lessonId={lesson.id} />
          </div>
        </SubSection>
      </div>
    </details>
  );
}

function SubSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2.5 text-sm font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      {children}
    </div>
  );
}
