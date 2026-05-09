import Link from "next/link";
import ModuleHeader from "./ModuleHeader";
import AddLessonForm from "./AddLessonForm";

interface OverviewLesson {
  id: string;
  title: string;
  isHidden: boolean;
  noSkill: boolean;
  contentCount: number;
  quizCount: number;
  assignmentCount: number;
}

export default function ModuleOverviewCard({
  courseId,
  module,
  order,
}: {
  courseId: string;
  module: {
    id: string;
    title: string;
    orderIndex: number;
    isHidden: boolean;
    lessons: OverviewLesson[];
  };
  order: number;
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border-2 transition-colors ${
        module.isHidden
          ? "border-danger-200 bg-danger-50/50"
          : "border-token bg-[rgb(var(--surface))]"
      }`}
    >
      <ModuleHeader
        moduleId={module.id}
        title={module.title}
        order={order}
        orderIndex={module.orderIndex}
        isHidden={module.isHidden}
      />

      <ul className="divide-y divide-token border-t border-token">
        {module.lessons.length === 0 && (
          <li className="px-4 py-6 text-center">
            <p className="text-sm text-muted">
              <span className="mr-1.5" aria-hidden>📭</span>
              Module này chưa có bài. Thêm bài đầu tiên bên dưới.
            </p>
          </li>
        )}
        {module.lessons.map((l, i) => (
          <li key={l.id}>
            <Link
              href={`/instructor/courses/${courseId}?lesson=${l.id}`}
              className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[rgb(var(--surface-muted))]"
            >
              <span className="w-6 flex-shrink-0 text-xs font-medium text-faint">
                {i + 1}.
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">
                {l.title}
              </span>
              {l.noSkill && (
                <span className="chip-accent text-xs">chưa tag skill</span>
              )}
              {l.isHidden && <span className="chip-danger text-xs">Ẩn</span>}
              <span className="hidden sm:inline text-xs text-faint">
                {l.contentCount}c · {l.quizCount}q · {l.assignmentCount}a
              </span>
              <span className="text-faint">›</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="border-t border-token p-3">
        <AddLessonForm
          moduleId={module.id}
          nextOrderIndex={module.lessons.length}
        />
      </div>
    </div>
  );
}
