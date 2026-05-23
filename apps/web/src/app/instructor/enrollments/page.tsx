import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STALE_DAYS = 14;

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  completed: "Hoàn thành",
  dropped: "Drop",
  refunded: "Refunded",
};
const STATUS_TONE: Record<string, string> = {
  active: "chip-brand",
  completed: "chip-success",
  dropped: "chip",
  refunded: "chip",
};

export default async function InstructorEnrollmentsPage({
  searchParams,
}: {
  searchParams?: { course?: string; status?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin?callbackUrl=/instructor/enrollments");
  }
  const userId = session.user.id;

  const ownedCourses = await prisma.course.findMany({
    where: { instructors: { some: { userId } } },
    select: { id: true, title: true, slug: true },
    orderBy: { title: "asc" },
  });
  if (ownedCourses.length === 0) {
    return (
      <main>
        <h1 className="h-display text-3xl font-bold">Enrollments</h1>
        <div className="mt-6 rounded-2xl border border-accent-200 bg-accent-50 p-5 text-sm">
          Bạn chưa là instructor của khoá nào.
        </div>
      </main>
    );
  }

  const courseFilter =
    searchParams?.course &&
    ownedCourses.some((c) => c.id === searchParams.course)
      ? searchParams.course
      : null;
  const statusFilter =
    searchParams?.status === "active" ||
    searchParams?.status === "completed" ||
    searchParams?.status === "dropped" ||
    searchParams?.status === "stale"
      ? searchParams.status
      : "all";

  const courseIds = courseFilter ? [courseFilter] : ownedCourses.map((c) => c.id);
  const staleCutoff = new Date(Date.now() - STALE_DAYS * 24 * 3600 * 1000);

  const baseWhere = { courseId: { in: courseIds } };

  const [enrollments, allStats] = await Promise.all([
    prisma.enrollment.findMany({
      where: {
        ...baseWhere,
        ...(statusFilter === "active"
          ? { status: "active" }
          : statusFilter === "completed"
            ? { status: "completed" }
            : statusFilter === "dropped"
              ? { status: { in: ["dropped", "refunded"] } }
              : {}),
      },
      orderBy: [{ status: "asc" }, { enrolledAt: "desc" }],
      take: 300,
      select: {
        id: true,
        userId: true,
        courseId: true,
        status: true,
        enrolledAt: true,
        completedAt: true,
        lastLessonId: true,
        user: { select: { displayName: true, email: true } },
        course: { select: { id: true, title: true, slug: true } },
      },
    }),
    prisma.enrollment.findMany({
      where: baseWhere,
      select: { status: true, userId: true, courseId: true },
    }),
  ]);

  // Stats from full set, not filtered.
  const total = allStats.length;
  const active = allStats.filter((e) => e.status === "active").length;
  const completed = allStats.filter((e) => e.status === "completed").length;
  const dropped = allStats.filter(
    (e) => e.status === "dropped" || e.status === "refunded",
  ).length;

  // Last-activity lookup via LearningEvent. Skip if no enrollments.
  const userCoursePairs = enrollments.map((e) => ({
    userId: e.userId,
    courseId: e.courseId,
  }));
  const lastActivityByPair = new Map<string, Date>();
  if (userCoursePairs.length > 0) {
    const events = await prisma.learningEvent.findMany({
      where: {
        userId: { in: [...new Set(userCoursePairs.map((p) => p.userId))] },
        courseId: { in: [...new Set(userCoursePairs.map((p) => p.courseId))] },
      },
      orderBy: { occurredAt: "desc" },
      select: { userId: true, courseId: true, occurredAt: true },
    });
    for (const ev of events) {
      const key = `${ev.userId}:${ev.courseId}`;
      if (!lastActivityByPair.has(key)) {
        lastActivityByPair.set(key, ev.occurredAt);
      }
    }
  }

  let staleCount = 0;
  if (statusFilter === "stale") {
    // Recount visible only.
    staleCount = enrollments.filter((e) => {
      if (e.status !== "active") return false;
      const last = lastActivityByPair.get(`${e.userId}:${e.courseId}`);
      return !last || last < staleCutoff;
    }).length;
  } else {
    // For KPI card we still need to compute stale among active overall.
    const activeEvents = await prisma.learningEvent.groupBy({
      by: ["userId", "courseId"],
      where: {
        userId: { in: allStats.filter((e) => e.status === "active").map((e) => e.userId) },
        courseId: { in: courseIds },
        occurredAt: { gte: staleCutoff },
      },
      _max: { occurredAt: true },
    });
    const recentSet = new Set(
      activeEvents.map((e) => `${e.userId}:${e.courseId}`),
    );
    staleCount = allStats.filter(
      (e) => e.status === "active" && !recentSet.has(`${e.userId}:${e.courseId}`),
    ).length;
  }

  const filterHref = (next: { course?: string | null; status?: string }) => {
    const params = new URLSearchParams();
    const c = next.course === undefined ? courseFilter : next.course;
    if (c) params.set("course", c);
    const s = next.status ?? statusFilter;
    if (s && s !== "all") params.set("status", s);
    const qs = params.toString();
    return `/instructor/enrollments${qs ? `?${qs}` : ""}`;
  };

  const filteredForDisplay =
    statusFilter === "stale"
      ? enrollments.filter((e) => {
          if (e.status !== "active") return false;
          const last = lastActivityByPair.get(`${e.userId}:${e.courseId}`);
          return !last || last < staleCutoff;
        })
      : enrollments;

  return (
    <main>
      <header>
        <h1 className="h-display text-3xl font-bold sm:text-4xl">Enrollments</h1>
        <p className="mt-2 text-muted">
          Học viên đang ghi danh ở các khoá của bạn. Stale = active nhưng không
          có hoạt động trong {STALE_DAYS} ngày.
        </p>
      </header>

      {/* KPI */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Kpi label="Tổng" value={total} tone="brand" />
        <Kpi label="Active" value={active} tone="brand" />
        <Kpi label="Hoàn thành" value={completed} tone="success" />
        <Kpi
          label={`Stale > ${STALE_DAYS}d`}
          value={staleCount}
          tone={staleCount > 0 ? "danger" : "success"}
        />
      </section>

      {/* Filters */}
      <div className="mt-8 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-faint">
          Khoá:
        </span>
        <Link
          href={filterHref({ course: null })}
          className={!courseFilter ? "chip-brand" : "chip"}
        >
          Tất cả
        </Link>
        {ownedCourses.map((c) => (
          <Link
            key={c.id}
            href={filterHref({ course: c.id })}
            className={courseFilter === c.id ? "chip-brand" : "chip"}
          >
            {c.title}
          </Link>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-faint">
          Trạng thái:
        </span>
        {(
          [
            { id: "all", label: "Tất cả" },
            { id: "active", label: "Active" },
            { id: "stale", label: `Stale > ${STALE_DAYS}d` },
            { id: "completed", label: "Đã hoàn thành" },
            { id: "dropped", label: "Drop / refund" },
          ] as const
        ).map((f) => (
          <Link
            key={f.id}
            href={filterHref({ status: f.id })}
            className={statusFilter === f.id ? "chip-brand" : "chip"}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {/* Table */}
      <section className="mt-8">
        {filteredForDisplay.length === 0 ? (
          <div className="rounded-2xl border border-token bg-[rgb(var(--surface))] p-10 text-center text-sm text-muted">
            Không có học viên nào khớp bộ lọc.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-token bg-[rgb(var(--surface))] shadow-card">
            <table className="w-full text-sm">
              <thead className="bg-[rgb(var(--surface-muted))]">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">Học viên</th>
                  <th className="px-4 py-3">Khoá</th>
                  <th className="px-4 py-3">Enrolled</th>
                  <th className="px-4 py-3">Hoạt động gần nhất</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-token">
                {filteredForDisplay.map((e) => {
                  const lastActivity = lastActivityByPair.get(
                    `${e.userId}:${e.courseId}`,
                  );
                  const isStale =
                    e.status === "active" &&
                    (!lastActivity || lastActivity < staleCutoff);
                  return (
                    <tr
                      key={e.id}
                      className="transition-colors hover:bg-[rgb(var(--surface-muted))]"
                    >
                      <td className="px-4 py-3 align-top">
                        <p className="font-medium">{e.user.displayName}</p>
                        <p className="mt-0.5 text-xs text-faint">
                          {e.user.email}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <Link
                          href={`/instructor/courses/${e.course.id}`}
                          className="text-xs hover:text-brand-600"
                        >
                          {e.course.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 align-top text-xs">
                        {new Date(e.enrolledAt).toLocaleDateString("vi-VN")}
                      </td>
                      <td className="px-4 py-3 align-top text-xs">
                        {lastActivity ? (
                          <span className={isStale ? "text-danger-600" : ""}>
                            {formatAgo(lastActivity)}
                          </span>
                        ) : (
                          <span className="text-faint">Chưa có</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {isStale ? (
                          <span className="chip-danger">Stale</span>
                        ) : e.status === "completed" ? (
                          <span className="chip-success">
                            {STATUS_LABEL[e.status]}
                          </span>
                        ) : (
                          <span className={STATUS_TONE[e.status] ?? "chip"}>
                            {STATUS_LABEL[e.status] ?? e.status}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-right">
                        <Link
                          href={`/instructor/courses/${e.course.id}/struggling-students`}
                          className="btn-ghost btn-sm"
                        >
                          HV cần hỗ trợ
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function formatAgo(d: Date | string): string {
  const ms = Date.now() - new Date(d).getTime();
  const hours = ms / (1000 * 3600);
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "brand" | "success" | "accent" | "danger";
}) {
  const toneClass = {
    brand: "text-brand-600",
    success: "text-success-600",
    accent: "text-accent-600",
    danger: "text-danger-600",
  }[tone];
  return (
    <div className="card">
      <div className={`h-display text-2xl font-bold tabular-nums ${toneClass}`}>
        {value}
      </div>
      <div className="mt-1 text-xs text-muted sm:text-sm">{label}</div>
    </div>
  );
}
