import Link from "next/link";
import LessonHeader from "./LessonHeader";
import SkillTagsEditor from "./SkillTagsEditor";
import LessonContent from "@/components/LessonContent";
import SafeHtml from "@/components/SafeHtml";
import { plainToRichHtml } from "@/lib/richText";
import ActivitySection from "./ActivitySection";

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
    pedagogicalIntent?:
      | "summarizing"
      | "mapping"
      | "drawing"
      | "imagining"
      | "self_explaining"
      | "teaching"
      | "enacting"
      | null;
    requireSelfRating?: boolean;
    requireReflection?: boolean;
    countsTowardGrade?: boolean;
  }>;
  // Unified ordered activity list — drives cross-type drag-drop. Each entry is
  // a thin pointer; ActivitySection joins by id back to contentItems / quizzes /
  // assignments arrays loaded alongside.
  activities?: Array<{
    id: string;
    kind: "content" | "quiz" | "assignment";
    orderIndex: number;
    contentItemId: string | null;
    quizId: string | null;
    assignmentId: string | null;
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
  moduleId,
  siblingLessonIds,
  modules,
  hideUntaggedWarning = false,
}: {
  lesson: Lesson;
  order: number;
  courseSlug: string;
  flat?: boolean;
  moduleId?: string;
  siblingLessonIds?: string[];
  modules?: Array<{ id: string; title: string }>;
  hideUntaggedWarning?: boolean;
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
          tags={lesson.skillTags.map((t) => ({
            skillId: t.skillId,
            code: t.skill.code,
            name: t.skill.name,
          }))}
          moduleId={moduleId}
          siblingLessonIds={siblingLessonIds}
          modules={modules}
          hideUntaggedWarning={hideUntaggedWarning}
        />

        {!flat && !(hideUntaggedWarning && noSkill) && (
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
        )}

        <div className="editor-only">
          <ActivitySection
            lessonId={lesson.id}
            contentItems={lesson.contentItems}
            quizzes={lesson.quizzes}
            assignments={lesson.assignments}
            activities={lesson.activities ?? []}
          />
        </div>

        <div className="preview-only space-y-5">
          <SubSection label={`Nội dung (${lesson.contentItems.length})`}>
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
          </SubSection>

          <SubSection label={`Quizzes (${lesson.quizzes.length})`}>
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
          </SubSection>

          <SubSection label={`Assignments (${lesson.assignments.length})`}>
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
                    <SafeHtml
                      html={plainToRichHtml(a.description)}
                      className="prose prose-sm mt-3 max-w-none text-muted dark:prose-invert"
                    />
                  </li>
                ))}
              </ul>
            )}
          </SubSection>
        </div>
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
