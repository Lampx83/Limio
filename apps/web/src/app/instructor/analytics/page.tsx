import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const TREND_DAYS = 30;
const ACTIVITY_EVENT_TYPES = [
  "lesson.viewed",
  "lesson.completed",
  "quiz.submitted",
  "assignment.submitted",
];

export default async function InstructorAnalyticsPage({
  searchParams,
}: {
  searchParams?: { course?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin?callbackUrl=/instructor/analytics");
  }
  const userId = session.user.id;

  const ownedCourses = await prisma.course.findMany({
    where: { instructors: { some: { userId } } },
    select: { id: true, title: true, slug: true, status: true },
    orderBy: { title: "asc" },
  });
  if (ownedCourses.length === 0) {
    return (
      <main>
        <h1 className="text-2xl font-bold">Analytics & Báo cáo</h1>
        <div className="mt-6 rounded-2xl border border-accent-200 bg-accent-50 p-5 text-sm">
          Bạn chưa là instructor của khoá nào.
        </div>
      </main>
    );
  }

  const selectedId =
    searchParams?.course && ownedCourses.some((c) => c.id === searchParams.course)
      ? searchParams.course
      : ownedCourses[0]!.id;
  const selected = ownedCourses.find((c) => c.id === selectedId)!;

  // ── Aggregate metrics ─────────────────────────────────────────────────
  const trendCutoff = new Date(Date.now() - TREND_DAYS * 24 * 3600 * 1000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);

  const [
    enrollGroups,
    lessonRows,
    assignmentSubsAgg,
    quizAttemptsAgg,
    activeLearnerRows,
    trendEvents,
    lessonViewEvents,
    lessonCompleteEvents,
    aiCostRows,
  ] = await Promise.all([
    prisma.enrollment.groupBy({
      by: ["status"],
      where: { courseId: selectedId },
      _count: true,
    }),
    prisma.lesson.findMany({
      where: { module: { courseId: selectedId } },
      orderBy: [{ module: { orderIndex: "asc" } }, { orderIndex: "asc" }],
      select: {
        id: true,
        title: true,
        module: { select: { title: true } },
      },
    }),
    prisma.assignmentSubmission.groupBy({
      by: ["status"],
      where: { assignment: { lesson: { module: { courseId: selectedId } } } },
      _count: true,
    }),
    prisma.quizAttempt.aggregate({
      where: { quiz: { courseId: selectedId }, status: "submitted" },
      _count: true,
      _avg: { scorePct: true },
    }),
    prisma.learningEvent.findMany({
      where: {
        courseId: selectedId,
        occurredAt: { gte: sevenDaysAgo },
        eventType: { in: ACTIVITY_EVENT_TYPES },
      },
      select: { userId: true },
      distinct: ["userId"],
    }),
    prisma.learningEvent.findMany({
      where: {
        courseId: selectedId,
        occurredAt: { gte: trendCutoff },
        eventType: { in: ACTIVITY_EVENT_TYPES },
      },
      select: { occurredAt: true, eventType: true },
    }),
    prisma.learningEvent.findMany({
      where: { courseId: selectedId, eventType: "lesson.viewed" },
      select: { userId: true, payload: true },
    }),
    prisma.learningEvent.findMany({
      where: { courseId: selectedId, eventType: "lesson.completed" },
      select: { userId: true, payload: true },
    }),
    prisma.aiUsageLog.findMany({
      where: {
        userId,
        dayKey: {
          gte: new Date(Date.now() - TREND_DAYS * 24 * 3600 * 1000)
            .toISOString()
            .slice(0, 10),
        },
      },
      select: { costUsd: true, tokensInput: true, tokensOutput: true },
    }),
  ]);

  // Enrollment funnel
  const enroll = { total: 0, active: 0, completed: 0, dropped: 0, refunded: 0 };
  for (const g of enrollGroups) {
    enroll.total += g._count;
    (enroll as Record<string, number>)[g.status] = g._count;
  }

  // Quiz: lượt nộp + điểm TB (quiz không còn ngưỡng đạt)
  const quizSubmitted = quizAttemptsAgg._count;
  const quizAvgScorePct =
    quizAttemptsAgg._avg.scorePct !== null
      ? Math.round(quizAttemptsAgg._avg.scorePct * 10) / 10
      : null;

  // Assignment status totals
  const assignmentStatus = { submitted: 0, graded: 0 };
  for (const g of assignmentSubsAgg) {
    (assignmentStatus as Record<string, number>)[g.status] = g._count;
  }

  // AI cost / tokens
  const aiCost = aiCostRows.reduce((s, r) => s + r.costUsd, 0);
  const aiTokens = aiCostRows.reduce(
    (s, r) => s + r.tokensInput + r.tokensOutput,
    0,
  );

  // ── Trend (30 days) — events grouped by day ───────────────────────────
  const trendByDay = new Map<string, number>();
  for (let i = 0; i < TREND_DAYS; i++) {
    const d = new Date(Date.now() - i * 24 * 3600 * 1000);
    trendByDay.set(d.toISOString().slice(0, 10), 0);
  }
  for (const ev of trendEvents) {
    const key = ev.occurredAt.toISOString().slice(0, 10);
    trendByDay.set(key, (trendByDay.get(key) ?? 0) + 1);
  }
  const trendArr = [...trendByDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, count]) => ({ day, count }));
  const trendMax = Math.max(1, ...trendArr.map((d) => d.count));

  // ── Per-lesson engagement ─────────────────────────────────────────────
  const viewsByLesson = new Map<string, Set<string>>(); // unique viewers
  const viewCountByLesson = new Map<string, number>();
  for (const ev of lessonViewEvents) {
    const lessonId = (ev.payload as { lessonId?: string } | null)?.lessonId;
    if (!lessonId) continue;
    viewCountByLesson.set(lessonId, (viewCountByLesson.get(lessonId) ?? 0) + 1);
    if (!ev.userId) continue;
    let set = viewsByLesson.get(lessonId);
    if (!set) {
      set = new Set();
      viewsByLesson.set(lessonId, set);
    }
    set.add(ev.userId);
  }
  const completionsByLesson = new Map<string, number>();
  for (const ev of lessonCompleteEvents) {
    const lessonId = (ev.payload as { lessonId?: string } | null)?.lessonId;
    if (!lessonId) continue;
    completionsByLesson.set(
      lessonId,
      (completionsByLesson.get(lessonId) ?? 0) + 1,
    );
  }

  const lessonStats = lessonRows.map((l) => {
    const uniqViewers = viewsByLesson.get(l.id)?.size ?? 0;
    const views = viewCountByLesson.get(l.id) ?? 0;
    const completions = completionsByLesson.get(l.id) ?? 0;
    const completionPct =
      uniqViewers > 0 ? Math.round((completions / uniqViewers) * 100) : 0;
    return {
      ...l,
      uniqViewers,
      views,
      completions,
      completionPct,
    };
  });
  const totalViewers = lessonStats.reduce((s, l) => s + l.uniqViewers, 0);

  return (
    <main>
      <header>
        <h1 className="text-2xl font-bold">
          Analytics & Báo cáo
        </h1>
        <p className="mt-2 text-muted">
          Phân tích sâu từng khoá: enrollment funnel, engagement theo bài học,
          xu hướng hoạt động {TREND_DAYS} ngày qua, xuất CSV.
        </p>
      </header>

      {/* Course picker */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-faint">
          Khoá:
        </span>
        {ownedCourses.map((c) => (
          <Link
            key={c.id}
            href={`/instructor/analytics?course=${c.id}`}
            className={c.id === selectedId ? "chip-brand" : "chip"}
            prefetch={false}
          >
            {c.title}
          </Link>
        ))}
      </div>

      {/* KPI */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Kpi label="Tổng enrollments" value={enroll.total} tone="brand" />
        <Kpi
          label="Active 7d"
          value={activeLearnerRows.length}
          sub={`/ ${enroll.active} active`}
          tone="brand"
        />
        <Kpi
          label="Điểm quiz TB"
          value={quizAvgScorePct !== null ? `${quizAvgScorePct}%` : "—"}
          sub={`${quizSubmitted} lượt nộp`}
          tone="brand"
        />
        <Kpi
          label={`AI cost ${TREND_DAYS}d`}
          value={`$${aiCost.toFixed(4)}`}
          sub={`${aiTokens.toLocaleString()} tokens`}
          tone="brand"
        />
      </section>

      {/* Enrollment funnel + assignment status */}
      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="text-sm font-semibold">Enrollment funnel</h2>
          <ul className="mt-3 space-y-2">
            <FunnelRow
              label="Active"
              value={enroll.active}
              total={Math.max(1, enroll.total)}
              tone="brand"
            />
            <FunnelRow
              label="Hoàn thành"
              value={enroll.completed}
              total={Math.max(1, enroll.total)}
              tone="success"
            />
            <FunnelRow
              label="Drop"
              value={enroll.dropped}
              total={Math.max(1, enroll.total)}
              tone="danger"
            />
            <FunnelRow
              label="Refund"
              value={enroll.refunded}
              total={Math.max(1, enroll.total)}
              tone="accent"
            />
          </ul>
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold">Assignment submissions</h2>
          <ul className="mt-3 space-y-2">
            <FunnelRow
              label="Chờ chấm"
              value={assignmentStatus.submitted}
              total={Math.max(
                1,
                assignmentStatus.submitted + assignmentStatus.graded,
              )}
              tone="accent"
            />
            <FunnelRow
              label="Đã chấm"
              value={assignmentStatus.graded}
              total={Math.max(
                1,
                assignmentStatus.submitted + assignmentStatus.graded,
              )}
              tone="success"
            />
          </ul>
        </div>
      </section>

      {/* Trend */}
      <section className="mt-8">
        <h2 className="text-base font-semibold">
          Hoạt động {TREND_DAYS} ngày qua
        </h2>
        <p className="text-xs text-faint">
          Mỗi cột = số event/ngày (lesson.viewed, lesson.completed, quiz.submitted,
          assignment.submitted)
        </p>
        <div className="mt-3 rounded-2xl border border-token bg-[rgb(var(--surface))] p-4 shadow-card">
          <div className="flex h-32 items-end gap-0.5">
            {trendArr.map((d) => {
              const h = (d.count / trendMax) * 100;
              return (
                <div
                  key={d.day}
                  className="group relative flex-1"
                  title={`${d.day}: ${d.count} event`}
                >
                  <div
                    className={`w-full rounded-t ${
                      d.count === 0
                        ? "bg-[rgb(var(--surface-muted))]"
                        : "bg-brand-500"
                    }`}
                    style={{ height: `${Math.max(h, 2)}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-faint">
            <span>{trendArr[0]?.day.slice(5)}</span>
            <span>{trendArr[trendArr.length - 1]?.day.slice(5)}</span>
          </div>
        </div>
      </section>

      {/* Per-lesson engagement */}
      <section className="mt-10">
        <h2 className="text-base font-semibold">Engagement theo bài học</h2>
        <p className="text-xs text-faint">
          Completion% = lesson.completed / unique viewers
        </p>
        {lessonStats.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-token bg-[rgb(var(--surface))] p-10 text-center text-sm text-muted">
            Chưa có dữ liệu bài học.
          </div>
        ) : (
          <div className="mt-3 overflow-hidden rounded-2xl border border-token bg-[rgb(var(--surface))] shadow-card">
            <table className="w-full text-sm">
              <thead className="bg-[rgb(var(--surface-muted))]">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">Bài học</th>
                  <th className="px-4 py-3 text-right">Unique viewer</th>
                  <th className="px-4 py-3 text-right">Tổng view</th>
                  <th className="px-4 py-3 text-right">Hoàn thành</th>
                  <th className="px-4 py-3">Completion %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-token">
                {lessonStats.map((l) => (
                  <tr
                    key={l.id}
                    className="transition-colors hover:bg-[rgb(var(--surface-muted))]"
                  >
                    <td className="px-4 py-3 align-top">
                      <p className="font-medium">{l.title}</p>
                      <p className="mt-0.5 text-xs text-faint">
                        {l.module.title}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right align-top tabular-nums">
                      {l.uniqViewers}
                    </td>
                    <td className="px-4 py-3 text-right align-top tabular-nums text-faint">
                      {l.views}
                    </td>
                    <td className="px-4 py-3 text-right align-top tabular-nums text-success-600">
                      {l.completions}
                    </td>
                    <td className="w-48 px-4 py-3 align-top">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[rgb(var(--surface-muted))]">
                          <div
                            className={`h-full rounded-full ${
                              l.completionPct >= 70
                                ? "bg-success-500"
                                : l.completionPct >= 30
                                  ? "bg-amber-400"
                                  : "bg-danger-500"
                            }`}
                            style={{ width: `${l.completionPct}%` }}
                          />
                        </div>
                        <span className="w-10 text-right text-xs tabular-nums text-faint">
                          {l.completionPct}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-faint">
          Tổng {totalViewers} viewer trên {lessonStats.length} bài học.
        </p>
      </section>

      {/* Exports / Reports */}
      <section className="mt-10">
        <h2 className="text-base font-semibold">Báo cáo (CSV)</h2>
        <p className="text-xs text-faint">
          Tải về dữ liệu khoá &ldquo;{selected.title}&rdquo; cho phân tích offline.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <ExportCard
            href={`/api/instructor/courses/${selectedId}/analytics/exports/enrollments`}
            title="Enrollments"
            desc="Danh sách enroll, trạng thái, ngày ghi danh / hoàn thành."
          />
          <ExportCard
            href={`/api/instructor/courses/${selectedId}/analytics/exports/lesson-progress`}
            title="Lesson progress"
            desc="Tiến độ từng học viên trên từng bài (viewed / completed)."
          />
          <ExportCard
            href={`/api/instructor/courses/${selectedId}/analytics/exports/quiz-gradebook`}
            title="Quiz gradebook"
            desc="Điểm quiz của mọi học viên × quiz."
          />
          <ExportCard
            href={`/api/instructor/courses/${selectedId}/analytics/exports/assignment-gradebook`}
            title="Assignment gradebook"
            desc="Điểm assignment + feedback đã chấm."
          />
          <ExportCard
            href={`/api/instructor/courses/${selectedId}/analytics/exports/gamification`}
            title="Gamification"
            desc="XP, level, streak và badge của từng học viên."
          />
        </div>
      </section>
    </main>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string | number;
  sub?: string;
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
      {sub && <div className="mt-0.5 text-xs text-faint">{sub}</div>}
    </div>
  );
}

function FunnelRow({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: "brand" | "success" | "accent" | "danger";
}) {
  const pct = Math.round((value / total) * 100);
  const barClass = {
    brand: "bg-brand-500",
    success: "bg-success-500",
    accent: "bg-amber-400",
    danger: "bg-danger-500",
  }[tone];
  return (
    <li className="flex items-center gap-3">
      <span className="w-20 text-xs text-muted">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[rgb(var(--surface-muted))]">
        <div
          className={`h-full rounded-full ${barClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-14 text-right text-xs tabular-nums">
        {value}{" "}
        <span className="text-faint">({pct}%)</span>
      </span>
    </li>
  );
}

function ExportCard({
  href,
  title,
  desc,
}: {
  href: string;
  title: string;
  desc: string;
}) {
  return (
    <a
      href={href}
      className="card-hover flex items-start gap-3 rounded-xl border border-token p-3 transition-colors hover:border-brand-200"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
        ↓
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-faint">{desc}</p>
      </div>
    </a>
  );
}
