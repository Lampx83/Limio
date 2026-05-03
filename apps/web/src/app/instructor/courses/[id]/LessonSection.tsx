import Link from "next/link";
import LessonHeader from "./LessonHeader";
import ContentItemsList from "./ContentItemsList";
import AddContentItemForm from "./AddContentItemForm";
import SkillTagsEditor from "./SkillTagsEditor";
import QuizSection from "./QuizSection";
import AddQuizForm from "./AddQuizForm";
import AssignmentSection from "./AssignmentSection";
import AddAssignmentForm from "./AddAssignmentForm";
import LessonContent from "@/components/LessonContent";

interface Lesson {
  id: string;
  title: string;
  description: string | null;
  orderIndex: number;
  previewable: boolean;
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
  }>;
}

export default function LessonSection({
  lesson,
  order,
  courseSlug,
}: {
  lesson: Lesson;
  order: number;
  courseSlug: string;
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
        {noSkill && <span className="chip-accent">chưa tag skill</span>}
        {lesson.previewable && <span className="chip">Preview</span>}
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
          previewable={lesson.previewable}
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
          <div className="editor-only">
            <ContentItemsList items={lesson.contentItems} />
            <div className="mt-2">
              <AddContentItemForm
                lessonId={lesson.id}
                nextOrderIndex={lesson.contentItems.length}
              />
            </div>
          </div>
          <div className="preview-only">
            {lesson.contentItems.length === 0 ? (
              <p className="rounded-lg border border-dashed border-token bg-[rgb(var(--surface-muted))/0.5] px-3 py-3 text-center text-sm text-muted">
                Bài này chưa có nội dung.
              </p>
            ) : (
              <LessonContent
                items={lesson.contentItems.map((c) => ({
                  id: c.id,
                  type: c.type,
                  payload: c.payload,
                  orderIndex: c.orderIndex,
                }))}
                lessonId={lesson.id}
              />
            )}
          </div>
        </SubSection>

        <SubSection label={`Quizzes (${lesson.quizzes.length})`}>
          <div className="editor-only">
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
          </div>
          <div className="preview-only">
            {lesson.quizzes.length === 0 ? (
              <p className="rounded-lg border border-dashed border-token bg-[rgb(var(--surface-muted))/0.5] px-3 py-3 text-center text-sm text-muted">
                Bài này chưa có quiz.
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {lesson.quizzes.map((q) => (
                  <li key={q.id}>
                    <Link
                      href={`/learn/${courseSlug}/quizzes/${q.id}`}
                      target="_blank"
                      rel="noopener"
                      className="card-hover group flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium transition-colors group-hover:text-brand-600">
                          {q.title}
                        </p>
                        <p className="mt-1 text-xs text-faint">
                          {q.questions.length} câu · diff {q.difficulty ?? "—"} ·
                          pass {q.passThresholdPct}%
                        </p>
                      </div>
                      <span className="text-brand-600">↗</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SubSection>

        <SubSection label={`Assignments (${lesson.assignments.length})`}>
          <div className="editor-only">
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
          </div>
          <div className="preview-only">
            {lesson.assignments.length === 0 ? (
              <p className="rounded-lg border border-dashed border-token bg-[rgb(var(--surface-muted))/0.5] px-3 py-3 text-center text-sm text-muted">
                Bài này chưa có assignment.
              </p>
            ) : (
              <ul className="space-y-3">
                {lesson.assignments.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-xl border border-token bg-[rgb(var(--surface))] p-4"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-token pb-3">
                      <p className="font-semibold">{a.title}</p>
                      <span className="text-xs text-faint">
                        max <span className="font-semibold">{a.maxScore}</span>đ
                        {a.dueAt && (
                          <>
                            {" · hạn "}
                            {new Date(a.dueAt).toLocaleString("vi-VN")}
                          </>
                        )}
                      </span>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm text-muted">
                      {a.description}
                    </p>
                  </li>
                ))}
              </ul>
            )}
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
