import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { getInstructorSkillCoverage } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ESSAY_STALE_HOURS = 48;
const ASSIGNMENT_STALE_HOURS = 24;
const FORUM_STALE_HOURS = 48;
const LEARNER_STALE_DAYS = 14;
const ACTIVITY_FEED_HOURS = 72;
const ACTIVITY_FEED_LIMIT = 12;

type Priority = "high" | "med" | "low";

interface PriorityItem {
  id: string;
  priority: Priority;
  title: string;
  detail: string;
  href: string;
  count: number;
}

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, med: 1, low: 2 };
const PRIORITY_STYLES: Record<Priority, { chip: string; dot: string }> = {
  high: { chip: "chip-danger", dot: "bg-danger-500" },
  med: { chip: "chip-accent", dot: "bg-amber-500" },
  low: { chip: "chip", dot: "bg-[rgb(var(--text-faint))]" },
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Chào buổi sáng";
  if (h < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

const EVENT_LABEL: Record<string, (payload: Record<string, unknown>) => string> = {
  "lesson.viewed": () => "đã xem 1 bài học",
  "lesson.completed": () => "hoàn thành 1 bài học",
  "quiz.submitted": () => "nộp 1 bài quiz",
  "quiz.question.answered": () => "trả lời 1 câu hỏi",
  "assignment.submitted": () => "nộp 1 assignment",
  "assignment.graded": () => "đã được chấm assignment",
  "forum.posted": () => "đăng câu hỏi mới trong forum",
  "forum.answered": () => "trả lời 1 thread forum",
  "enrollment.created": () => "ghi danh khoá học",
  "course.completed": () => "🎉 hoàn thành khoá học",
};

export default async function InstructorDashboard() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/instructor/dashboard");
  const userId = session.user.id;

  const ownedCourses = await prisma.course.findMany({
    where: { instructors: { some: { userId } } },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      _count: { select: { enrollments: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (ownedCourses.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="h-display text-3xl font-bold">{greeting()}</h1>
        <div className="mt-6 rounded-2xl border border-accent-200 bg-accent-50 p-5">
          <p className="text-sm font-semibold text-accent-700">
            Bạn chưa là instructor của khoá nào.
          </p>
          <Link href="/instructor/courses/new" className="btn-primary mt-4 inline-flex">
            + Tạo khoá đầu tiên
          </Link>
        </div>
      </main>
    );
  }

  const courseIds = ownedCourses.map((c) => c.id);
  const now = Date.now();
  const essayCutoff = new Date(now - ESSAY_STALE_HOURS * 3600 * 1000);
  const assignmentCutoff = new Date(now - ASSIGNMENT_STALE_HOURS * 3600 * 1000);
  const forumCutoff = new Date(now - FORUM_STALE_HOURS * 3600 * 1000);
  const learnerStaleCutoff = new Date(
    now - LEARNER_STALE_DAYS * 24 * 3600 * 1000,
  );
  const activityCutoff = new Date(now - ACTIVITY_FEED_HOURS * 3600 * 1000);

  // ── Compute priority queue items ──────────────────────────────────────
  const [
    staleEssays,
    pendingEssaysTotal,
    staleAssignments,
    pendingAssignmentsTotal,
    staleForumThreads,
    activeEnrollments,
    recentActivityEvents,
  ] = await Promise.all([
    prisma.answerResponse.count({
      where: {
        needsGrading: true,
        manualScore: null,
        answeredAt: { lt: essayCutoff },
        attempt: { quiz: { courseId: { in: courseIds } } },
      },
    }),
    prisma.answerResponse.count({
      where: {
        needsGrading: true,
        manualScore: null,
        attempt: { quiz: { courseId: { in: courseIds } } },
      },
    }),
    prisma.assignmentSubmission.count({
      where: {
        status: "submitted",
        submittedAt: { lt: assignmentCutoff },
        assignment: { lesson: { module: { courseId: { in: courseIds } } } },
      },
    }),
    prisma.assignmentSubmission.count({
      where: {
        status: "submitted",
        assignment: { lesson: { module: { courseId: { in: courseIds } } } },
      },
    }),
    prisma.forumThread.count({
      where: {
        resolvedPostId: null,
        createdAt: { lt: forumCutoff },
        lesson: { module: { courseId: { in: courseIds } } },
      },
    }),
    prisma.enrollment.findMany({
      where: { courseId: { in: courseIds }, status: "active" },
      select: { userId: true, courseId: true },
    }),
    prisma.learningEvent.findMany({
      where: {
        courseId: { in: courseIds },
        occurredAt: { gte: activityCutoff },
      },
      orderBy: { occurredAt: "desc" },
      take: ACTIVITY_FEED_LIMIT,
      select: {
        id: true,
        userId: true,
        eventType: true,
        occurredAt: true,
        payload: true,
        courseId: true,
        user: { select: { displayName: true } },
      },
    }),
  ]);

  // Stale learners — active enrollments with no event in last LEARNER_STALE_DAYS.
  let staleLearnerCount = 0;
  if (activeEnrollments.length > 0) {
    const recentActiveEvents = await prisma.learningEvent.groupBy({
      by: ["userId", "courseId"],
      where: {
        userId: { in: activeEnrollments.map((e) => e.userId) },
        courseId: { in: courseIds },
        occurredAt: { gte: learnerStaleCutoff },
      },
      _max: { occurredAt: true },
    });
    const recentSet = new Set(
      recentActiveEvents.map((e) => `${e.userId}:${e.courseId}`),
    );
    staleLearnerCount = activeEnrollments.filter(
      (e) => !recentSet.has(`${e.userId}:${e.courseId}`),
    ).length;
  }

  // Skill coverage gaps.
  const coverage = await getInstructorSkillCoverage(userId);
  const untaggedLiveLessons = coverage.totals.untaggedLiveLessons;
  const untaggedLiveQuestions = coverage.totals.untaggedLiveQuestions;

  // Build priority items list.
  const items: PriorityItem[] = [];
  if (staleEssays > 0) {
    items.push({
      id: "essays-stale",
      priority: "high",
      title: `${staleEssays} essay đã chờ > ${ESSAY_STALE_HOURS}h`,
      detail: `Tổng ${pendingEssaysTotal} essay chờ chấm`,
      href: "/instructor/grade-essays",
      count: staleEssays,
    });
  } else if (pendingEssaysTotal > 0) {
    items.push({
      id: "essays-pending",
      priority: "med",
      title: `${pendingEssaysTotal} essay chờ chấm`,
      detail: "Chấm tay theo từng response",
      href: "/instructor/grade-essays",
      count: pendingEssaysTotal,
    });
  }
  if (staleForumThreads > 0) {
    items.push({
      id: "forum-stale",
      priority: "high",
      title: `${staleForumThreads} thread forum > ${FORUM_STALE_HOURS}h chưa giải đáp`,
      detail: "Học viên đang chờ phản hồi từ bạn",
      href: "/instructor/forum?status=stale",
      count: staleForumThreads,
    });
  }
  if (staleAssignments > 0) {
    items.push({
      id: "assignments-stale",
      priority: "med",
      title: `${staleAssignments} assignment đã chờ > ${ASSIGNMENT_STALE_HOURS}h`,
      detail: `Tổng ${pendingAssignmentsTotal} chờ chấm`,
      href: "/instructor/assignments?view=pending",
      count: staleAssignments,
    });
  } else if (pendingAssignmentsTotal > 0) {
    items.push({
      id: "assignments-pending",
      priority: "low",
      title: `${pendingAssignmentsTotal} assignment chờ chấm`,
      detail: "Stream theo nộp sớm nhất",
      href: "/instructor/assignments?view=pending",
      count: pendingAssignmentsTotal,
    });
  }
  if (staleLearnerCount > 0) {
    items.push({
      id: "learners-stale",
      priority: "med",
      title: `${staleLearnerCount} học viên không hoạt động > ${LEARNER_STALE_DAYS} ngày`,
      detail: "Cân nhắc gửi reminder hoặc check-in",
      href: "/instructor/enrollments?status=stale",
      count: staleLearnerCount,
    });
  }
  if (untaggedLiveLessons > 0) {
    items.push({
      id: "skill-lessons",
      priority: "low",
      title: `${untaggedLiveLessons} lesson live chưa tag skill`,
      detail: "Cần tag để BKT track mastery cho học viên",
      href: "/instructor/skill-tagging",
      count: untaggedLiveLessons,
    });
  }
  if (untaggedLiveQuestions > 0) {
    items.push({
      id: "skill-questions",
      priority: "low",
      title: `${untaggedLiveQuestions} question live chưa tag skill`,
      detail: "Câu hỏi chưa tag không feed vào BKT learner model",
      href: "/instructor/skill-tagging",
      count: untaggedLiveQuestions,
    });
  }

  items.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  // ── Context line for greeting ─────────────────────────────────────────
  const highCount = items.filter((i) => i.priority === "high").length;
  const totalLearners = ownedCourses.reduce((s, c) => s + c._count.enrollments, 0);
  let contextLine: string;
  if (highCount > 0) {
    contextLine = `Có ${highCount} việc gấp cần xử lý hôm nay.`;
  } else if (items.length > 0) {
    contextLine = `Có ${items.length} việc cần xem qua khi rảnh.`;
  } else {
    contextLine = `Mọi thứ đang ổn. ${totalLearners} học viên trên ${ownedCourses.length} khoá của bạn.`;
  }

  // Activity feed deep links.
  const courseSlugById = new Map(
    ownedCourses.map((c) => [c.id, c.slug] as const),
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      {/* Greeting */}
      <header>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
          Giảng viên
        </span>
        <h1 className="mt-3 h-display text-3xl font-bold sm:text-4xl">
          {greeting()},{" "}
          <span className="text-gradient">
            {session.user.name ?? session.user.email}
          </span>
        </h1>
        <p className="mt-2 text-muted">{contextLine}</p>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* Priority queue */}
        <section className="lg:col-span-2">
          <header className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold">
              Cần xử lý gấp{" "}
              <span className="text-xs font-normal text-faint">
                ({items.length})
              </span>
            </h2>
            <span className="text-xs text-faint">
              Sắp theo độ ưu tiên
            </span>
          </header>

          {items.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-success-200 bg-success-50 p-8 text-center text-sm text-success-700">
              🎉 Bạn không có việc gì gấp. Tận hưởng nhé.
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {items.map((it) => {
                const style = PRIORITY_STYLES[it.priority];
                return (
                  <li key={it.id}>
                    <Link
                      href={it.href}
                      className="card-hover flex items-start gap-3 rounded-xl border border-token p-4 transition-colors hover:border-brand-200"
                    >
                      <span
                        className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${style.dot}`}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <p className="font-semibold">{it.title}</p>
                          <span className={`${style.chip} text-[10px]`}>
                            {it.priority === "high"
                              ? "GẤP"
                              : it.priority === "med"
                                ? "MED"
                                : "LOW"}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted">{it.detail}</p>
                      </div>
                      <span className="shrink-0 self-center text-sm text-faint">
                        →
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Activity feed */}
        <section className="lg:col-span-1">
          <header className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold">Hoạt động gần đây</h2>
            <span className="text-xs text-faint">{ACTIVITY_FEED_HOURS}h qua</span>
          </header>

          {recentActivityEvents.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-token bg-[rgb(var(--surface))] p-6 text-center text-sm text-muted">
              Chưa có hoạt động.
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {recentActivityEvents.map((ev) => {
                const label =
                  EVENT_LABEL[ev.eventType]?.(
                    ev.payload as Record<string, unknown>,
                  ) ?? ev.eventType;
                const slug = ev.courseId
                  ? courseSlugById.get(ev.courseId)
                  : undefined;
                const href = slug ? `/learn/${slug}` : "/instructor/enrollments";
                return (
                  <li
                    key={ev.id.toString()}
                    className="rounded-lg border border-token bg-[rgb(var(--surface))] p-3 text-sm transition-colors hover:bg-[rgb(var(--surface-muted))]"
                  >
                    <Link href={href} className="block">
                      <p className="line-clamp-2">
                        <span className="font-medium">
                          {ev.user?.displayName ?? "—"}
                        </span>{" "}
                        <span className="text-muted">{label}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-faint">
                        {formatAgo(ev.occurredAt)}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function formatAgo(d: Date | string): string {
  const ms = Date.now() - new Date(d).getTime();
  const mins = ms / (1000 * 60);
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${Math.round(mins)}m trước`;
  const hrs = mins / 60;
  if (hrs < 24) return `${Math.round(hrs)}h trước`;
  return `${Math.round(hrs / 24)}d trước`;
}
