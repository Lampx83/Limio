import Link from "next/link";
import { prisma } from "@feedbackme/db";
import { EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/datetime";
import { loadAssignmentsWithCounts } from "./assignmentQueries";

export type CourseAssignmentsBuildHref = (n: {
  lesson?: string | null;
  filter?: string;
}) => string;

/**
 * Bước 2+3 của drill-down assignment, đã cố định 1 khoá học: danh sách bài
 * học theo thứ tự module → assignment của bài học đã chọn. Dùng chung giữa
 * trang /instructor/assignments (sau khi chọn khoá ở bước 1) và tab
 * "Assignment" trong trang biên soạn khoá học (courses/[id]).
 */
export default async function CourseAssignmentsBrowser({
  courseId,
  courseTitle,
  requestedLessonId,
  filter,
  buildHref,
  backToAllCoursesHref,
}: {
  courseId: string;
  courseTitle: string;
  requestedLessonId: string | null;
  filter: string;
  buildHref: CourseAssignmentsBuildHref;
  backToAllCoursesHref?: string;
}) {
  const modules = await prisma.module.findMany({
    where: { courseId },
    orderBy: { orderIndex: "asc" },
    select: {
      id: true,
      title: true,
      lessons: {
        orderBy: { orderIndex: "asc" },
        select: { id: true, title: true },
      },
    },
  });
  const allLessons = modules.flatMap((m) =>
    m.lessons.map((l) => ({ ...l, moduleTitle: m.title })),
  );
  const selectedLessonId =
    requestedLessonId && allLessons.some((l) => l.id === requestedLessonId)
      ? requestedLessonId
      : null;

  const assignments = await loadAssignmentsWithCounts(modules.map((m) => m.id));

  // Bước 2: danh sách bài học trong khoá, theo thứ tự module.
  if (!selectedLessonId) {
    const byLesson = new Map<
      string,
      { assignmentCount: number; pendingCount: number; gradedCount: number }
    >();
    for (const a of assignments) {
      const cur = byLesson.get(a.lessonId!) ?? {
        assignmentCount: 0,
        pendingCount: 0,
        gradedCount: 0,
      };
      cur.assignmentCount += 1;
      cur.pendingCount += a.counts.pending;
      cur.gradedCount += a.counts.graded;
      byLesson.set(a.lessonId!, cur);
    }

    return (
      <section className="mt-8">
        {backToAllCoursesHref && (
          <Link
            href={backToAllCoursesHref}
            className="link inline-flex items-center gap-1 text-sm"
          >
            ← Tất cả khoá học
          </Link>
        )}
        <h2 className={backToAllCoursesHref ? "mt-3 text-lg font-semibold" : "text-lg font-semibold"}>
          {courseTitle}
        </h2>
        <p className="text-sm text-muted">Chọn bài học để xem assignment.</p>

        {modules.length === 0 ? (
          <EmptyState
            className="mt-4"
            icon="📖"
            title="Khoá học chưa có bài học"
            description="Thêm module + bài học trong trang biên soạn khoá học."
            actions={[
              {
                label: "Mở trang biên soạn",
                href: `/instructor/courses/${courseId}`,
                variant: "secondary",
              },
            ]}
          />
        ) : (
          <div className="mt-4 space-y-6">
            {modules.map((m) => (
              <div key={m.id}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">
                  {m.title}
                </h3>
                {m.lessons.length === 0 ? (
                  <p className="mt-2 text-xs text-faint">Chưa có bài học.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-token overflow-hidden rounded-2xl border border-token bg-[rgb(var(--surface))] shadow-card">
                    {m.lessons.map((l) => {
                      const s = byLesson.get(l.id) ?? {
                        assignmentCount: 0,
                        pendingCount: 0,
                        gradedCount: 0,
                      };
                      return (
                        <li key={l.id}>
                          <Link
                            href={buildHref({ lesson: l.id })}
                            className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-[rgb(var(--surface-muted))]"
                            prefetch={false}
                          >
                            <span className="min-w-0 truncate">{l.title}</span>
                            <span className="flex shrink-0 items-center gap-2 text-xs text-faint">
                              {s.assignmentCount === 0 ? (
                                "Chưa có assignment"
                              ) : (
                                <>
                                  {s.assignmentCount} assignment
                                  {s.pendingCount > 0 && (
                                    <span className="chip-accent text-[10px]">
                                      {s.pendingCount} chờ
                                    </span>
                                  )}
                                </>
                              )}
                              <span aria-hidden>→</span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }

  // Bước 3: danh sách assignment của bài học đã chọn.
  const lesson = allLessons.find((l) => l.id === selectedLessonId)!;
  const lessonAssignments = assignments.filter((a) => a.lessonId === selectedLessonId);
  const filtered = lessonAssignments.filter((a) => {
    if (filter === "pending") return a.counts.pending > 0;
    if (filter === "hidden") return a.isHidden;
    return true;
  });

  return (
    <section className="mt-8">
      <Link
        href={buildHref({ lesson: null })}
        className="link inline-flex items-center gap-1 text-sm"
      >
        ← {courseTitle}
      </Link>
      <h2 className="mt-3 text-lg font-semibold">{lesson.title}</h2>
      <p className="text-sm text-muted">{lesson.moduleTitle}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-faint">
          Trạng thái:
        </span>
        {(
          [
            { id: "all", label: "Tất cả" },
            { id: "pending", label: "Có bài chờ chấm" },
            { id: "hidden", label: "Đang ẩn" },
          ] as const
        ).map((f) => (
          <Link
            key={f.id}
            href={buildHref({ filter: f.id })}
            className={filter === f.id ? "chip-brand" : "chip"}
            prefetch={false}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="mt-4">
        {filtered.length === 0 ? (
          <EmptyState
            icon="🔍"
            title={
              lessonAssignments.length === 0
                ? "Bài học này chưa có assignment"
                : "Không có assignment khớp bộ lọc"
            }
            description={
              lessonAssignments.length === 0
                ? "Thêm assignment cho bài học này trong trang biên soạn khoá học."
                : "Đổi bộ lọc trạng thái để xem thêm."
            }
            actions={
              lessonAssignments.length === 0
                ? [
                    {
                      label: "Mở trang biên soạn",
                      href: `/instructor/courses/${courseId}`,
                      variant: "secondary",
                    },
                  ]
                : undefined
            }
          />
        ) : (
          <ul className="space-y-3">
            {filtered.map((a) => {
              const due = a.dueAt ? new Date(a.dueAt) : null;
              const overdue = due && due < new Date();
              return (
                <li
                  key={a.id}
                  className="rounded-xl border border-token bg-[rgb(var(--surface))] p-4 shadow-card"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/instructor/assignments/${a.id}/submissions`}
                          className="font-medium hover:text-brand-600 hover:underline"
                          prefetch={false}
                        >
                          {a.title}
                        </Link>
                        {a.isHidden && <span className="chip text-[10px]">Đang ẩn</span>}
                      </div>
                      <p className="mt-0.5 text-xs text-faint">
                        Tối đa {a.maxScore} điểm ·{" "}
                        {due ? (
                          <span className={overdue ? "text-danger-600" : ""}>
                            Hạn {formatDate(due)}
                          </span>
                        ) : (
                          "Không hạn"
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-xs">
                      <span className="text-faint">
                        {a.counts.graded}/{a.counts.total} chấm
                      </span>
                      {a.counts.pending > 0 && (
                        <span className="chip-accent">{a.counts.pending} chờ</span>
                      )}
                      <Link
                        href={`/instructor/assignments/${a.id}/submissions`}
                        className="btn-secondary btn-sm"
                        prefetch={false}
                      >
                        Chấm bài
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
