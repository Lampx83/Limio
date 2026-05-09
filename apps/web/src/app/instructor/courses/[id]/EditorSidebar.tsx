import Link from "next/link";

interface SidebarLesson {
  id: string;
  title: string;
  isHidden: boolean;
  noSkill: boolean;
  contentCount: number;
  quizCount: number;
  assignmentCount: number;
}

interface SidebarModule {
  id: string;
  title: string;
  isHidden: boolean;
  lessons: SidebarLesson[];
}

export default function EditorSidebar({
  courseId,
  modules,
  activeLessonId,
  view,
}: {
  courseId: string;
  modules: SidebarModule[];
  activeLessonId?: string;
  view: "edit" | "preview";
}) {
  const baseHref = `/instructor/courses/${courseId}`;
  const overviewHref = view === "preview" ? `${baseHref}?view=preview` : baseHref;
  const lessonHref = (lessonId: string) =>
    view === "preview"
      ? `${baseHref}?view=preview&lesson=${lessonId}`
      : `${baseHref}?lesson=${lessonId}`;

  const isOverviewActive = !activeLessonId;

  return (
    <aside className="sticky top-4 self-start max-h-[calc(100vh-2rem)] w-64 flex-shrink-0 overflow-y-auto rounded-2xl border border-token bg-[rgb(var(--surface))] p-3 text-sm">
      <Link
        href={overviewHref}
        className={`block rounded-lg px-3 py-2 font-semibold transition-colors ${
          isOverviewActive
            ? "bg-brand-soft text-brand-700"
            : "hover:bg-[rgb(var(--surface-muted))]"
        }`}
      >
        Tổng quan khóa
      </Link>

      <div className="mt-2 space-y-1">
        {modules.length === 0 && (
          <p className="px-3 py-4 text-xs text-faint">
            Chưa có module nào.
          </p>
        )}
        {modules.map((m, mi) => {
          const moduleHasActive = m.lessons.some((l) => l.id === activeLessonId);
          return (
            <details key={m.id} open={moduleHasActive || mi < 3} className="group">
              <summary className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted hover:bg-[rgb(var(--surface-muted))]">
                <span className="text-faint group-open:rotate-90 transition-transform">
                  ›
                </span>
                <span className="truncate">
                  {mi + 1}. {m.title}
                </span>
                {m.isHidden && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-danger-500" title="Module ẩn" />
                )}
              </summary>
              <ul className="mt-0.5 space-y-0.5 pl-4">
                {m.lessons.length === 0 && (
                  <li className="px-3 py-1.5 text-xs text-faint">— chưa có bài</li>
                )}
                {m.lessons.map((l, li) => {
                  const active = l.id === activeLessonId;
                  return (
                    <li key={l.id}>
                      <Link
                        href={lessonHref(l.id)}
                        className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                          active
                            ? "bg-brand-soft font-medium text-brand-700"
                            : "text-default hover:bg-[rgb(var(--surface-muted))]"
                        }`}
                      >
                        <span className="text-xs text-faint w-5 flex-shrink-0">
                          {li + 1}.
                        </span>
                        <span className="truncate flex-1">{l.title}</span>
                        {l.noSkill && (
                          <span
                            className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent-500"
                            title="Chưa tag skill"
                          />
                        )}
                        {l.isHidden && (
                          <span
                            className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-danger-500"
                            title="Bài ẩn"
                          />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </details>
          );
        })}
      </div>
    </aside>
  );
}
