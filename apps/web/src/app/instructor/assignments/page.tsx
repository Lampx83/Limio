import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import { EmptyState, KpiCard } from "@/components/ui";
import { formatDate } from "@/lib/datetime";

export const dynamic = "force-dynamic";

type View = "list" | "pending";

export default async function InstructorAssignmentsPage({
  searchParams,
}: {
  searchParams?: { course?: string; filter?: string; view?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin?callbackUrl=/instructor/assignments");
  }
  const userId = session.user.id;

  const ownedCourses = await prisma.course.findMany({
    where: { instructors: { some: { userId } } },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });

  if (ownedCourses.length === 0) {
    return (
      <main>
        <h1 className="h-display text-h1">Chấm bài</h1>
        <EmptyState
          className="mt-6"
          icon="📝"
          title="Bạn chưa là instructor của khoá nào"
          description="Tạo khoá đầu tiên để có assignment cần chấm."
          actions={[{ label: "+ Tạo khoá", href: "/instructor/courses/new" }]}
        />
      </main>
    );
  }

  const courseIds = ownedCourses.map((c) => c.id);
  const selectedCourseId =
    searchParams?.course && courseIds.includes(searchParams.course)
      ? searchParams.course
      : null;
  const filter = searchParams?.filter ?? "all";
  const view: View = searchParams?.view === "pending" ? "pending" : "list";

  const scopedCourseIds = selectedCourseId ? [selectedCourseId] : courseIds;

  // KPI metrics: pending grading + totals + overdue.
  const [
    pendingSubmissionsCount,
    pendingEssaysCount,
    totalAssignments,
    gradedSubmissionsCount,
    overdueAssignments,
  ] = await Promise.all([
    prisma.assignmentSubmission.count({
      where: {
        status: "submitted",
        assignment: { lesson: { module: { courseId: { in: scopedCourseIds } } } },
      },
    }),
    prisma.answerResponse.count({
      where: {
        needsGrading: true,
        manualScore: null,
        attempt: { quiz: { courseId: { in: scopedCourseIds } } },
      },
    }),
    prisma.assignment.count({
      where: { lesson: { module: { courseId: { in: scopedCourseIds } } } },
    }),
    prisma.assignmentSubmission.count({
      where: {
        status: "graded",
        assignment: { lesson: { module: { courseId: { in: scopedCourseIds } } } },
      },
    }),
    prisma.assignment.count({
      where: {
        dueAt: { lt: new Date() },
        lesson: { module: { courseId: { in: scopedCourseIds } } },
        submissions: { some: { status: "submitted" } },
      },
    }),
  ]);
  const totalPending = pendingSubmissionsCount + pendingEssaysCount;

  const buildHref = (next: { course?: string | null; filter?: string; view?: View }) => {
    const params = new URLSearchParams();
    const c = next.course === undefined ? selectedCourseId : next.course;
    if (c) params.set("course", c);
    const f = next.filter ?? filter;
    if (f && f !== "all") params.set("filter", f);
    const v = next.view ?? view;
    if (v && v !== "list") params.set("view", v);
    const qs = params.toString();
    return `/instructor/assignments${qs ? `?${qs}` : ""}`;
  };

  return (
    <main>
      {/* Back link */}
      <Link
        href="/instructor/dashboard"
        className="link inline-flex items-center gap-1 text-sm"
      >
        ← Dashboard
      </Link>

      {/* Header */}
      <header className="mt-4">
        <span className="chip-brand">Instructor</span>
        <h1 className="mt-3 h-display text-h1">Chấm bài</h1>
        <p className="mt-2 text-muted">
          Quản lý assignment + chấm tập trung mọi submission đang chờ trong{" "}
          {ownedCourses.length} khoá bạn phụ trách.
        </p>
      </header>

      {/* KPI cards */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <KpiCard label="Tổng assignment" value={totalAssignments} tone="brand" />
        <KpiCard
          label="Đang chờ chấm"
          value={totalPending}
          sub={
            totalPending > 0
              ? `${pendingSubmissionsCount} bài nộp · ${pendingEssaysCount} tự luận`
              : "Sạch hết"
          }
          tone={totalPending > 0 ? "accent" : "success"}
        />
        <KpiCard
          label="Đã chấm"
          value={gradedSubmissionsCount}
          tone="success"
        />
        <KpiCard
          label="Assignment quá hạn"
          value={overdueAssignments}
          sub={overdueAssignments > 0 ? "Còn bài chưa chấm" : undefined}
          tone={overdueAssignments > 0 ? "danger" : "success"}
        />
      </section>

      {/* Tabs */}
      <div className="mt-8 flex gap-1 border-b border-token">
        <Link
          href={buildHref({ view: "list" })}
          className={
            "border-b-2 px-4 py-2 text-sm transition-colors " +
            (view === "list"
              ? "border-brand-500 font-semibold text-brand-700 dark:text-brand-300"
              : "border-transparent text-muted hover:text-[rgb(var(--text))]")
          }
        >
          Danh sách assignment
        </Link>
        <Link
          href={buildHref({ view: "pending" })}
          className={
            "inline-flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm transition-colors " +
            (view === "pending"
              ? "border-brand-500 font-semibold text-brand-700 dark:text-brand-300"
              : "border-transparent text-muted hover:text-[rgb(var(--text))]")
          }
        >
          Cần chấm
          {totalPending > 0 && (
            <span className="rounded-full bg-accent-100 px-1.5 text-[10px] font-semibold tabular-nums text-accent-700">
              {totalPending}
            </span>
          )}
        </Link>
      </div>

      {/* Common: course filter */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-faint">
          Khoá:
        </span>
        <Link
          href={buildHref({ course: null })}
          className={selectedCourseId === null ? "chip-brand" : "chip"}
        >
          Tất cả ({ownedCourses.length})
        </Link>
        {ownedCourses.map((c) => (
          <Link
            key={c.id}
            href={buildHref({ course: c.id })}
            className={selectedCourseId === c.id ? "chip-brand" : "chip"}
            prefetch={false}
          >
            {c.title}
          </Link>
        ))}
      </div>

      {view === "list" ? (
        <AssignmentListView
          courseIds={scopedCourseIds}
          filter={filter}
          buildHref={buildHref}
        />
      ) : (
        <PendingStreamView courseIds={scopedCourseIds} />
      )}
    </main>
  );
}

async function AssignmentListView({
  courseIds,
  filter,
  buildHref,
}: {
  courseIds: string[];
  filter: string;
  buildHref: (n: { filter?: string; view?: View }) => string;
}) {
  const assignments = await prisma.assignment.findMany({
    where: { lesson: { module: { courseId: { in: courseIds } } } },
    select: {
      id: true,
      title: true,
      dueAt: true,
      maxScore: true,
      isHidden: true,
      createdAt: true,
      lesson: {
        select: {
          id: true,
          title: true,
          module: {
            select: { course: { select: { id: true, title: true } } },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const submissionCounts = await prisma.assignmentSubmission.groupBy({
    by: ["assignmentId", "status"],
    where: { assignmentId: { in: assignments.map((a) => a.id) } },
    _count: { _all: true },
  });
  const countsByAssignment = new Map<
    string,
    { pending: number; graded: number; total: number }
  >();
  for (const row of submissionCounts) {
    const existing = countsByAssignment.get(row.assignmentId) ?? {
      pending: 0,
      graded: 0,
      total: 0,
    };
    if (row.status === "submitted") existing.pending = row._count._all;
    if (row.status === "graded") existing.graded = row._count._all;
    existing.total = existing.pending + existing.graded;
    countsByAssignment.set(row.assignmentId, existing);
  }

  const enriched = assignments.map((a) => ({
    ...a,
    counts: countsByAssignment.get(a.id) ?? { pending: 0, graded: 0, total: 0 },
  }));

  const filtered = enriched.filter((a) => {
    if (filter === "pending") return a.counts.pending > 0;
    if (filter === "hidden") return a.isHidden;
    return true;
  });
  return (
    <>
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
            href={buildHref({ filter: f.id, view: "list" })}
            className={filter === f.id ? "chip-brand" : "chip"}
            prefetch={false}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <section className="mt-8">
        {filtered.length === 0 ? (
          <EmptyState
            icon="🔍"
            title="Không có bài tập khớp bộ lọc"
            description="Đổi khoá hoặc bộ lọc trạng thái để xem thêm."
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-hidden rounded-2xl border border-token bg-[rgb(var(--surface))] shadow-card lg:block">
              <table className="w-full text-sm">
                <thead className="bg-[rgb(var(--surface-muted))]">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted">
                    <th className="px-4 py-3">Tiêu đề</th>
                    <th className="px-4 py-3">Khoá / Bài học</th>
                    <th className="px-4 py-3">Hạn nộp</th>
                    <th className="px-4 py-3 text-right">Chờ chấm</th>
                    <th className="px-4 py-3 text-right">Đã chấm</th>
                    <th className="px-4 py-3 text-right">Tổng</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-token">
                  {filtered.map((a) => {
                    const due = a.dueAt ? new Date(a.dueAt) : null;
                    const overdue = due && due < new Date();
                    return (
                      <tr
                        key={a.id}
                        className="transition-colors hover:bg-[rgb(var(--surface-muted))]"
                      >
                        <td className="px-4 py-3 align-top">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{a.title}</span>
                            {a.isHidden && (
                              <span className="chip text-[10px]">Đang ẩn</span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-faint">
                            Tối đa {a.maxScore} điểm
                          </p>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <p className="text-xs text-muted">
                            {a.lesson?.module.course.title ?? ""}
                          </p>
                          <p className="mt-0.5 text-xs text-faint">
                            {a.lesson?.title ?? ""}
                          </p>
                        </td>
                        <td className="px-4 py-3 align-top text-xs">
                          {due ? (
                            <span className={overdue ? "text-danger-600" : ""}>
                              {formatDate(due)}
                            </span>
                          ) : (
                            <span className="text-faint">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right align-top tabular-nums">
                          {a.counts.pending > 0 ? (
                            <span className="chip-accent">{a.counts.pending}</span>
                          ) : (
                            <span className="text-faint">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right align-top tabular-nums text-success-600">
                          {a.counts.graded}
                        </td>
                        <td className="px-4 py-3 text-right align-top tabular-nums">
                          {a.counts.total}
                        </td>
                        <td className="px-4 py-3 text-right align-top">
                          <Link
                            href={`/instructor/assignments/${a.id}/submissions`}
                            className="btn-secondary btn-sm"
                          >
                            Chấm bài
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile card stack */}
            <ul className="space-y-3 lg:hidden">
              {filtered.map((a) => {
                const due = a.dueAt ? new Date(a.dueAt) : null;
                const overdue = due && due < new Date();
                return (
                  <li key={a.id} className="rounded-xl border border-token bg-[rgb(var(--surface))] p-4 shadow-card">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="line-clamp-1 font-medium">{a.title}</span>
                          {a.isHidden && <span className="chip text-[10px] shrink-0">Ẩn</span>}
                        </div>
                        <p className="mt-0.5 text-xs text-muted">{a.lesson?.module.course.title ?? ""}</p>
                        <p className="text-xs text-faint">{a.lesson?.title ?? ""}</p>
                      </div>
                      {a.counts.pending > 0 && (
                        <span className="chip-accent shrink-0">{a.counts.pending} chờ</span>
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-token pt-3 text-xs">
                      <span className="text-faint">
                        {due ? (
                          <span className={overdue ? "text-danger-600" : ""}>
                            Hạn: {formatDate(due)}
                          </span>
                        ) : "Không hạn"} · {a.counts.graded}/{a.counts.total} chấm
                      </span>
                      <Link
                        href={`/instructor/assignments/${a.id}/submissions`}
                        className="btn-secondary btn-sm"
                        prefetch={false}
                      >
                        Chấm
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </>
  );
}

async function PendingStreamView({ courseIds }: { courseIds: string[] }) {
  const [assignmentSubs, essayResps] = await Promise.all([
    prisma.assignmentSubmission.findMany({
      where: {
        status: "submitted",
        assignment: { lesson: { module: { courseId: { in: courseIds } } } },
      },
      orderBy: { submittedAt: "asc" },
      take: 100,
      select: {
        id: true,
        submittedAt: true,
        user: { select: { displayName: true, email: true } },
        assignment: {
          select: {
            id: true,
            title: true,
            lesson: {
              select: {
                title: true,
                module: {
                  select: { course: { select: { id: true, title: true } } },
                },
              },
            },
          },
        },
      },
    }),
    prisma.answerResponse.findMany({
      where: {
        needsGrading: true,
        manualScore: null,
        attempt: { quiz: { courseId: { in: courseIds } } },
      },
      orderBy: { answeredAt: "asc" },
      take: 100,
      select: {
        id: true,
        answeredAt: true,
        question: { select: { prompt: true } },
        attempt: {
          select: {
            user: { select: { displayName: true, email: true } },
            quiz: {
              select: {
                title: true,
                courseId: true,
                lesson: {
                  select: {
                    title: true,
                    module: {
                      select: { course: { select: { id: true, title: true } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  type StreamItem = {
    key: string;
    kind: "assignment" | "essay";
    submittedAt: Date;
    learnerName: string;
    learnerEmail: string;
    courseTitle: string;
    title: string;
    subTitle: string;
    href: string;
  };

  const items: StreamItem[] = [
    ...assignmentSubs.map<StreamItem>((s) => ({
      key: `a:${s.id}`,
      kind: "assignment",
      submittedAt: s.submittedAt,
      learnerName: s.user.displayName,
      learnerEmail: s.user.email,
      courseTitle: s.assignment.lesson?.module.course.title ?? "",
      title: s.assignment.title,
      subTitle: s.assignment.lesson?.title ?? "",
      href: `/instructor/assignments/${s.assignment.id}/submissions`,
    })),
    ...essayResps.map<StreamItem>((r) => {
      const course =
        r.attempt.quiz.lesson?.module.course ??
        ({ id: r.attempt.quiz.courseId, title: "—" } as { id: string | null; title: string });
      return {
        key: `e:${r.id}`,
        kind: "essay",
        submittedAt: r.answeredAt,
        learnerName: r.attempt.user.displayName,
        learnerEmail: r.attempt.user.email,
        courseTitle: course.title,
        title: r.attempt.quiz.title,
        subTitle: r.question.prompt.slice(0, 120),
        href: `/instructor/grade-essays#essay-${r.id}`,
      };
    }),
  ].sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());

  return (
    <>
      <div className="mt-3 text-sm text-muted">
        {items.length} item chờ chấm, sắp xếp theo nộp sớm nhất.
      </div>
      <section className="mt-8">
        {items.length === 0 ? (
          <EmptyState
            icon="🎉"
            title="Không còn bài nào chờ chấm"
            description="Tất cả submission đã được chấm xong. Kiểm tra lại lần sau."
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-token bg-[rgb(var(--surface))] shadow-card">
            <table className="w-full text-sm">
              <thead className="bg-[rgb(var(--surface-muted))]">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">Loại</th>
                  <th className="px-4 py-3">Học viên</th>
                  <th className="px-4 py-3">Khoá / Nội dung</th>
                  <th className="px-4 py-3">Chờ</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-token">
                {items.map((it) => (
                  <tr
                    key={it.key}
                    className="transition-colors hover:bg-[rgb(var(--surface-muted))]"
                  >
                    <td className="px-4 py-3 align-top">
                      {it.kind === "assignment" ? (
                        <span className="chip-accent text-[10px]">Assignment</span>
                      ) : (
                        <span className="chip text-[10px]">Essay quiz</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <p className="text-sm">{it.learnerName}</p>
                      <p className="mt-0.5 text-xs text-faint">{it.learnerEmail}</p>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <p className="text-xs text-muted">{it.courseTitle}</p>
                      <p className="mt-0.5 line-clamp-1 text-sm">{it.title}</p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-faint">
                        {it.subTitle}
                      </p>
                    </td>
                    <td className="px-4 py-3 align-top text-xs">
                      {formatAgo(it.submittedAt)}
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      <Link href={it.href} className="btn-secondary btn-sm" prefetch={false}>
                        Chấm
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function formatAgo(d: Date | string): string {
  const ms = Date.now() - new Date(d).getTime();
  const hours = ms / (1000 * 3600);
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}
