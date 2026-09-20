import Link from "next/link";
import { prisma } from "@feedbackme/db";
import { EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/datetime";
import { loadAssignmentsWithCounts, loadQuizzesWithStats } from "./assignmentQueries";

export type GradeFilter = "all" | "assignment" | "quiz" | "pending";

const FILTERS: Array<{ id: GradeFilter; label: string }> = [
  { id: "all", label: "Tất cả" },
  { id: "assignment", label: "Assignment" },
  { id: "quiz", label: "Quiz" },
  { id: "pending", label: "Chờ chấm" },
];

/**
 * Tab "Grade" của trang biên soạn khoá: một trang phẳng, gom theo module →
 * bài học, hiện assignment và quiz cùng lúc để nhìn được kết quả cả khoá mà
 * không phải bấm vào từng bài.
 */
export default async function CourseGradeOverview({
  courseId,
  filter,
  buildHref,
}: {
  courseId: string;
  filter: string;
  buildHref: (filter: GradeFilter) => string;
}) {
  const active: GradeFilter = FILTERS.some((f) => f.id === filter)
    ? (filter as GradeFilter)
    : "all";

  const modules = await prisma.module.findMany({
    where: { courseId },
    orderBy: { orderIndex: "asc" },
    select: {
      id: true,
      title: true,
      lessons: { orderBy: { orderIndex: "asc" }, select: { id: true, title: true } },
    },
  });
  const moduleIds = modules.map((m) => m.id);
  const [assignments, quizzes] = await Promise.all([
    loadAssignmentsWithCounts(moduleIds),
    loadQuizzesWithStats(moduleIds),
  ]);

  const totalPending = assignments.reduce((n, a) => n + a.counts.pending, 0);
  const showAssignments = active !== "quiz";
  const showQuizzes = active === "all" || active === "quiz";

  const blocks = modules
    .map((m) => {
      const lessons = m.lessons
        .map((l) => ({
          ...l,
          assignments: showAssignments
            ? assignments.filter(
                (a) => a.lessonId === l.id && (active !== "pending" || a.counts.pending > 0),
              )
            : [],
          quizzes: showQuizzes ? quizzes.filter((q) => q.lessonId === l.id) : [],
        }))
        .filter((l) => l.assignments.length + l.quizzes.length > 0);
      return { ...m, lessons };
    })
    .filter((m) => m.lessons.length > 0);

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f.id}
              href={buildHref(f.id)}
              className={active === f.id ? "chip-brand" : "chip"}
              prefetch={false}
            >
              {f.label}
              {f.id === "pending" && totalPending > 0 ? ` (${totalPending})` : ""}
            </Link>
          ))}
        </div>
        <p className="text-xs text-faint">
          {assignments.length} assignment · {quizzes.length} quiz
        </p>
      </div>

      {blocks.length === 0 ? (
        <EmptyState
          className="mt-4"
          icon="🔍"
          title={
            assignments.length + quizzes.length === 0
              ? "Khoá học chưa có assignment hay quiz"
              : "Không có mục nào khớp bộ lọc"
          }
          description={
            assignments.length + quizzes.length === 0
              ? "Thêm assignment hoặc quiz cho bài học trong tab Nội dung."
              : "Đổi bộ lọc để xem thêm."
          }
        />
      ) : (
        <div className="mt-4 space-y-6">
          {blocks.map((m) => (
            <div key={m.id}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">
                {m.title}
              </h3>
              <div className="mt-2 divide-y divide-token overflow-hidden rounded-2xl border border-token bg-[rgb(var(--surface))] shadow-card">
                {m.lessons.map((l) => (
                  <div key={l.id}>
                    <div className="bg-[rgb(var(--surface-muted))] px-4 py-2 text-xs font-semibold text-muted">
                      {l.title}
                    </div>
                    <ul className="divide-y divide-token">
                      {l.assignments.map((a) => {
                        const due = a.dueAt ? new Date(a.dueAt) : null;
                        const overdue = due && due < new Date();
                        return (
                          <li key={a.id}>
                            <Link
                              href={`/instructor/assignments/${a.id}/submissions`}
                              prefetch={false}
                              className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 px-4 py-3 text-sm transition-colors hover:bg-[rgb(var(--surface-muted))] sm:grid-cols-[auto_1fr_auto]"
                            >
                              <span className="chip text-[10px]">Assignment</span>
                              <span className="min-w-0">
                                <span className="block truncate font-medium">
                                  {a.title}
                                  {a.isHidden && (
                                    <span className="chip ml-2 text-[10px]">Đang ẩn</span>
                                  )}
                                </span>
                                <span className="block text-xs text-faint">
                                  Tối đa {a.maxScore} điểm ·{" "}
                                  {due ? (
                                    <span className={overdue ? "text-danger-600" : ""}>
                                      Hạn {formatDate(due)}
                                    </span>
                                  ) : (
                                    "Không hạn"
                                  )}
                                </span>
                              </span>
                              <span className="col-span-2 flex items-center gap-2 text-xs text-faint sm:col-span-1">
                                {a.counts.graded}/{a.counts.total} đã chấm
                                {a.counts.pending > 0 && (
                                  <span className="chip-accent">{a.counts.pending} chờ</span>
                                )}
                                <span aria-hidden>→</span>
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                      {l.quizzes.map((q) => (
                        <li key={q.id}>
                          <Link
                            href={`/instructor/courses/${courseId}/quizzes/${q.id}/results`}
                            prefetch={false}
                            className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 px-4 py-3 text-sm transition-colors hover:bg-[rgb(var(--surface-muted))] sm:grid-cols-[auto_1fr_auto]"
                          >
                            <span className="chip-brand text-[10px]">Quiz</span>
                            <span className="min-w-0">
                              <span className="block truncate font-medium">
                                {q.title}
                                {q.isHidden && (
                                  <span className="chip ml-2 text-[10px]">Đang ẩn</span>
                                )}
                              </span>
                              <span className="block text-xs text-faint">
                                {q._count.questions} câu
                              </span>
                            </span>
                            <span className="col-span-2 flex items-center gap-2 text-xs text-faint sm:col-span-1">
                              {q.stats.attempts === 0
                                ? "Chưa có lượt làm"
                                : `${q.stats.students} SV · TB ${Math.round(q.stats.avgScorePct ?? 0)}%`}
                              <span aria-hidden>→</span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
