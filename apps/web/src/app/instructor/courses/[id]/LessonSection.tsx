import Link from "next/link";
import LessonHeader from "./LessonHeader";
import ContentItemsList from "./ContentItemsList";
import SkillTagsEditor from "./SkillTagsEditor";
import QuizSection from "./QuizSection";
import AssignmentSection from "./AssignmentSection";
import LessonContent from "@/components/LessonContent";
import LessonAddBar from "./LessonAddBar";
import EmptyState from "./EmptyState";

interface Lesson {
  id: string;
  title: string;
  description: string | null;
  orderIndex: number;
  previewable: boolean;
  isHidden: boolean;
  contentItems: Array<{
    id: string;
    type: string;
    payload: unknown;
    orderIndex: number;
    isHidden: boolean;
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
    isHidden: boolean;
  }>;
  quizzes: Array<{
    id: string;
    title: string;
    difficulty: number | null;
    passThresholdPct: number;
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
  }>;
}

export default function LessonSection({
  lesson,
  order,
  courseSlug,
  flat = false,
}: {
  lesson: Lesson;
  order: number;
  courseSlug: string;
  flat?: boolean;
}) {
  const noSkill = lesson.skillTags.length === 0;
  const hiddenContent = lesson.contentItems.filter(c => c.isHidden).length;
  const hiddenQuizzes = lesson.quizzes.filter(q => q.isHidden).length;
  const hiddenAssignments = lesson.assignments.filter(a => a.isHidden).length;
  const totalHiddenItems = hiddenContent + hiddenQuizzes + hiddenAssignments;

  const body = (
      <div className={flat ? "space-y-5" : "border-t border-token px-4 py-4 space-y-5"}>
        <LessonHeader
          lessonId={lesson.id}
          title={lesson.title}
          description={lesson.description}
          order={order}
          orderIndex={lesson.orderIndex}
          previewable={lesson.previewable}
          isHidden={lesson.isHidden}
          noSkill={noSkill}
          showTitle={flat}
        />

        <div className="editor-only">
          <LessonAddBar
            lessonId={lesson.id}
            nextContentOrderIndex={lesson.contentItems.length}
          />
        </div>

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
              <EmptyState
                icon="❓"
                title="Chưa có quiz"
                description="Quiz giúp kiểm tra hiểu biết của học viên ngay sau khi học."
                cta={{
                  label: "+ Thêm quiz",
                  eventName: "lesson-add:open",
                  eventDetail: { mode: "quiz" },
                }}
              />
            ) : (
              <ol className="space-y-2">
                {lesson.quizzes.map((q) => (
                  <li key={q.id}>
                    <QuizSection quiz={q} lessonId={lesson.id} />
                  </li>
                ))}
              </ol>
            )}
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
              <EmptyState
                icon="📝"
                title="Chưa có assignment"
                description="Assignment sẽ được instructor chấm tay."
                cta={{
                  label: "+ Thêm assignment",
                  eventName: "lesson-add:open",
                  eventDetail: { mode: "assignment" },
                }}
              />
            ) : (
              <ol className="space-y-2">
                {lesson.assignments.map((a) => (
                  <li key={a.id}>
                    <AssignmentSection assignment={a} />
                  </li>
                ))}
              </ol>
            )}
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
  );

  if (flat) return body;

  return (
    <details
      open
      className={`overflow-hidden rounded-xl border-2 transition-colors ${
        lesson.isHidden
          ? 'border-danger-200 bg-danger-50/50'
          : 'border-brand-200 bg-[rgb(var(--surface))]'
      }`}
    >
      <summary className="flex flex-wrap items-center gap-2 cursor-pointer px-4 py-3 hover:bg-[rgb(var(--surface-muted))/0.5] transition-colors">
        <span className="text-base font-semibold">
          <span className="mr-2 text-sm font-normal text-faint">Lesson {order}</span>
          {lesson.title}
        </span>
        {lesson.isHidden && <span className="chip-danger">👁️ Ẩn</span>}
        {noSkill && <span className="chip-accent">chưa tag skill</span>}
        {lesson.previewable && <span className="chip">Preview</span>}
        <span className="ml-auto text-sm text-muted">
          {lesson.contentItems.length} content · {lesson.quizzes.length} quiz ·{" "}
          {lesson.assignments.length} assignment
        </span>
        {totalHiddenItems > 0 && (
          <span className="flex items-center gap-1 text-xs text-danger-600">
            <span className="w-1.5 h-1.5 rounded-full bg-danger-600"></span>
            {totalHiddenItems} ẩn
          </span>
        )}
      </summary>
      {body}
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
    <section>
      <h3 className="mb-2 text-sm font-semibold text-default">{label}</h3>
      {children}
    </section>
  );
}
