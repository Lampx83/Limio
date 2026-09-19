import LessonHeader from "./LessonHeader";
import SkillTagsEditor from "./SkillTagsEditor";
import ActivitySection from "./ActivitySection";

interface Lesson {
  id: string;
  title: string;
  description: string | null;
  orderIndex: number;
  previewable: boolean;
  isHidden: boolean;
  isLocked: boolean;
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
  titleAside,
}: {
  lesson: Lesson;
  order: number;
  courseSlug: string;
  flat?: boolean;
  moduleId?: string;
  siblingLessonIds?: string[];
  modules?: Array<{ id: string; title: string }>;
  hideUntaggedWarning?: boolean;
  titleAside?: React.ReactNode;
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
          isLocked={lesson.isLocked}
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
          courseSlug={courseSlug}
          hideUntaggedWarning={hideUntaggedWarning}
          titleAside={titleAside}
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

        <ActivitySection
          lessonId={lesson.id}
          contentItems={lesson.contentItems}
          quizzes={lesson.quizzes}
          assignments={lesson.assignments}
          activities={lesson.activities ?? []}
        />
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
