import LessonSection from "./LessonSection";
import AddLessonForm from "./AddLessonForm";
import ModuleHeader from "./ModuleHeader";
import SortableModulesWrapper from "./SortableModulesWrapper";

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
  isLocked: boolean;
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
  isLocked: boolean;
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
  quizzes: Array<{
    id: string;
    title: string;
    difficulty: number | null;
    passThresholdPct: number;
    requireConfidence: boolean;
    timeLimitSec: number | null;
    maxAttempts: number | null;
    isHidden: boolean;
  isLocked: boolean;
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

interface Module {
  id: string;
  title: string;
  orderIndex: number;
  isHidden: boolean;
  isLocked: boolean;
  lessons: Lesson[];
}

export default function ModuleSection({
  module,
  order,
  courseSlug,
}: {
  module: Module;
  order: number;
  courseSlug: string;
}) {
  const hiddenLessons = module.lessons.filter(l => l.isHidden).length;

  return (
    <div className={`overflow-hidden rounded-2xl border-2 transition-colors ${
      module.isHidden
        ? 'border-danger-200 bg-danger-50/50'
        : 'border-brand-200 bg-[rgb(var(--surface))]'
    } shadow-card`}>
      <ModuleHeader
        moduleId={module.id}
        title={module.title}
        order={order}
        orderIndex={module.orderIndex}
        isHidden={module.isHidden}
        isLocked={module.isLocked}
      />

      {/* Module Stats */}
      <div className="border-t border-token px-4 py-2.5 flex items-center justify-between text-sm bg-[rgb(var(--surface-muted))/0.3]">
        <div className="flex items-center gap-4 text-xs text-muted">
          <span>{module.lessons.length} bài học</span>
          {hiddenLessons > 0 && (
            <span className="flex items-center gap-1 text-danger-600">
              <span className="w-2 h-2 rounded-full bg-danger-600"></span>
              {hiddenLessons} ẩn
            </span>
          )}
        </div>
      </div>

      {/* Lessons Container */}
      <div className="border-t border-token bg-[rgb(var(--surface-muted))/0.2] p-4 space-y-3">
        <SortableModulesWrapper
          reorderEndpoint={`/api/modules/${module.id}/lessons/reorder`}
          payloadKey="orderedLessonIds"
          items={module.lessons.map((l, i) => ({
            id: l.id,
            node: <LessonSection lesson={l} order={i + 1} courseSlug={courseSlug} />,
          }))}
        />
        <div className="mt-2">
          <AddLessonForm
            moduleId={module.id}
            nextOrderIndex={module.lessons.length}
          />
        </div>
      </div>
    </div>
  );
}
