import LessonSection from "./LessonSection";
import AddLessonForm from "./AddLessonForm";
import ModuleHeader from "./ModuleHeader";
import SortableModulesWrapper from "./SortableModulesWrapper";

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

interface Module {
  id: string;
  title: string;
  orderIndex: number;
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
  return (
    <div className="overflow-hidden rounded-2xl border border-token bg-[rgb(var(--surface))] shadow-card">
      <ModuleHeader
        moduleId={module.id}
        title={module.title}
        order={order}
        orderIndex={module.orderIndex}
      />
      <div className="border-t border-token bg-[rgb(var(--surface-muted))/0.4] p-4">
        <SortableModulesWrapper
          reorderEndpoint={`/api/modules/${module.id}/lessons/reorder`}
          payloadKey="orderedLessonIds"
          items={module.lessons.map((l, i) => ({
            id: l.id,
            node: <LessonSection lesson={l} order={i + 1} courseSlug={courseSlug} />,
          }))}
        />
        <div className="mt-3">
          <AddLessonForm
            moduleId={module.id}
            nextOrderIndex={module.lessons.length}
          />
        </div>
      </div>
    </div>
  );
}
