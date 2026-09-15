import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BookOpen,
  ClipboardList,
  FileText,
  HelpCircle,
  ListChecks,
  MessageSquare,
  Tag,
  UserX,
  Users,
  type LucideIcon,
} from "lucide-react";
import { prisma } from "@feedbackme/db";
import {
  getInstructorSkillCoverage,
  userIsAnyProctor,
} from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import UserAvatar from "@/components/ui/UserAvatar";

export const dynamic = "force-dynamic";

const ESSAY_STALE_HOURS = 48;
const ASSIGNMENT_STALE_HOURS = 24;
const FORUM_STALE_HOURS = 48;
const LEARNER_STALE_DAYS = 14;
const ACTIVITY_FEED_HOURS = 72;
const ACTIVITY_FEED_LIMIT = 12;

type Priority = "high" | "med" | "low";
type Category = "essay" | "forum" | "assignment" | "learner" | "skill";

interface PriorityItem {
  id: string;
  priority: Priority;
  category: Category;
  title: string;
  detail: string;
  href: string;
  count: number;
}

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, med: 1, low: 2 };
const TIER_LABEL: Record<Priority, string> = {
  high: "Gấp",
  med: "Trung bình",
  low: "Có thể chờ",
};
// Tier styling drives color (urgency); category (CATEGORY_ICON below) drives
// icon shape — kept separate so "94 lesson chưa tag" (low) and "30 học viên
// im ắng" (med) read at a glance without matching text first.
const PRIORITY_STYLES: Record<
  Priority,
  {
    chip: string;
    tierLabelColor: string;
    bar: string;
    cardBg: string;
    iconBg: string;
    iconFg: string;
  }
> = {
  high: {
    chip: "chip-danger",
    tierLabelColor: "text-danger-700",
    bar: "bg-danger-500",
    cardBg: "bg-[rgb(var(--surface))]",
    iconBg: "bg-danger-50",
    iconFg: "text-danger-600",
  },
  med: {
    chip: "chip-accent",
    tierLabelColor: "text-accent-700",
    bar: "bg-accent-500",
    cardBg: "bg-[rgb(var(--surface))]",
    iconBg: "bg-accent-50",
    iconFg: "text-accent-600",
  },
  low: {
    chip: "chip",
    tierLabelColor: "text-faint",
    bar: "bg-slate-300",
    cardBg: "bg-[rgb(var(--surface-muted))]",
    iconBg: "bg-[rgb(var(--surface))]",
    iconFg: "text-muted",
  },
};
const CATEGORY_ICON: Record<Category, LucideIcon> = {
  essay: FileText,
  forum: MessageSquare,
  assignment: ClipboardList,
  learner: UserX,
  skill: Tag,
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

  // Proctor-only users (no CourseInstructor binding) land here when they
  // first log in; redirect them straight to their rooms to skip the empty
  // instructor dashboard.
  const isInstructor = await prisma.courseInstructor.findFirst({
    where: { userId },
    select: { id: true },
  });
  if (!isInstructor && (await userIsAnyProctor(userId))) {
    redirect("/instructor/my-rooms");
  }

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
      <main>
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
    courseStaff,
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
    prisma.courseInstructor.findMany({
      where: { courseId: { in: courseIds } },
      select: { userId: true },
    }),
  ]);

  // "Hoạt động gần đây" is a learner-engagement feed (EVENT_LABEL below only
  // translates learner-facing event types), so exclude anyone holding a
  // CourseInstructor row on these courses at the query level — a demo/test
  // account that is dual-registered as both instructor and learner on the
  // same course (seen in dev data) is excluded too, since its events can't
  // be told apart without per-event role context.
  const courseStaffIds = courseStaff.map((s) => s.userId);
  const recentActivityEvents = await prisma.learningEvent.findMany({
    where: {
      courseId: { in: courseIds },
      occurredAt: { gte: activityCutoff },
      ...(courseStaffIds.length > 0
        ? { userId: { notIn: courseStaffIds } }
        : {}),
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
  });

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
      category: "essay",
      title: `${staleEssays} essay đã chờ > ${ESSAY_STALE_HOURS}h`,
      detail: `Tổng ${pendingEssaysTotal} essay chờ chấm`,
      href: "/instructor/grade-essays",
      count: staleEssays,
    });
  } else if (pendingEssaysTotal > 0) {
    items.push({
      id: "essays-pending",
      priority: "med",
      category: "essay",
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
      category: "forum",
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
      category: "assignment",
      title: `${staleAssignments} assignment đã chờ > ${ASSIGNMENT_STALE_HOURS}h`,
      detail: `Tổng ${pendingAssignmentsTotal} chờ chấm`,
      href: "/instructor/assignments?view=pending",
      count: staleAssignments,
    });
  } else if (pendingAssignmentsTotal > 0) {
    items.push({
      id: "assignments-pending",
      priority: "low",
      category: "assignment",
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
      category: "learner",
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
      category: "skill",
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
      category: "skill",
      title: `${untaggedLiveQuestions} question live chưa tag skill`,
      detail: "Câu hỏi chưa tag không feed vào BKT learner model",
      href: "/instructor/skill-tagging",
      count: untaggedLiveQuestions,
    });
  }

  items.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  const tiers = (["high", "med", "low"] as const)
    .map((priority) => ({ priority, items: items.filter((i) => i.priority === priority) }))
    .filter((tier) => tier.items.length > 0);

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

  // Activity feed deep links + course tag.
  const courseSlugById = new Map(
    ownedCourses.map((c) => [c.id, c.slug] as const),
  );
  const courseTitleById = new Map(
    ownedCourses.map((c) => [c.id, c.title] as const),
  );

  return (
    <main>
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

      {/* Stat strip */}
      <div className="mt-7 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <StatTile
          icon={BookOpen}
          iconBg="bg-[rgb(var(--brand-soft))]"
          iconFg="text-brand-600"
          value={ownedCourses.length}
          label="Khoá học đang dạy"
        />
        <StatTile
          icon={Users}
          iconBg="bg-[rgb(var(--brand-soft))]"
          iconFg="text-brand-600"
          value={totalLearners}
          label="Học viên"
        />
        <StatTile
          icon={ListChecks}
          iconBg="bg-accent-50"
          iconFg="text-accent-600"
          value={items.length}
          label="Việc cần xử lý"
        />
        <StatTile
          icon={UserX}
          iconBg="bg-danger-50"
          iconFg="text-danger-600"
          value={staleLearnerCount}
          label={`Học viên im ắng >${LEARNER_STALE_DAYS} ngày`}
        />
      </div>

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

          {tiers.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-success-200 bg-success-50 p-8 text-center text-sm text-success-700">
              🎉 Bạn không có việc gì gấp. Tận hưởng nhé.
            </div>
          ) : (
            <div className="mt-3 space-y-6">
              {tiers.map((tier) => {
                const style = PRIORITY_STYLES[tier.priority];
                return (
                  <div key={tier.priority}>
                    <p
                      className={`mb-2 text-[11px] font-extrabold uppercase tracking-[0.1em] ${style.tierLabelColor}`}
                    >
                      {TIER_LABEL[tier.priority]} · {tier.items.length}
                    </p>
                    <ul className="space-y-2">
                      {tier.items.map((it) => {
                        const Icon = CATEGORY_ICON[it.category];
                        return (
                          <li key={it.id}>
                            <Link
                              href={it.href}
                              className={`card-hover relative flex items-start gap-3.5 overflow-hidden rounded-2xl border border-token py-4 pl-5 pr-4 transition-colors hover:border-brand-200 ${style.cardBg}`}
                              prefetch={false}
                            >
                              <span
                                className={`absolute inset-y-0 left-0 w-1 ${style.bar}`}
                                aria-hidden
                              />
                              <span
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${style.iconBg} ${style.iconFg}`}
                                aria-hidden
                              >
                                <Icon size={19} strokeWidth={2} />
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-baseline gap-2 flex-wrap">
                                  <p className="font-semibold">{it.title}</p>
                                  <span className={`${style.chip} text-[10px] font-bold`}>
                                    {tier.priority === "high"
                                      ? "GẤP"
                                      : tier.priority === "med"
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
                  </div>
                );
              })}
            </div>
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
            <div className="relative mt-3 rounded-2xl border border-token bg-[rgb(var(--surface))] p-4">
              <div
                className="absolute bottom-5 left-[35px] top-5 w-px bg-[rgb(var(--border))]"
                aria-hidden
              />
              <ul className="space-y-4">
                {recentActivityEvents.map((ev) => {
                  const label =
                    EVENT_LABEL[ev.eventType]?.(
                      ev.payload as Record<string, unknown>,
                    ) ?? ev.eventType;
                  const slug = ev.courseId
                    ? courseSlugById.get(ev.courseId)
                    : undefined;
                  const courseTitle = ev.courseId
                    ? courseTitleById.get(ev.courseId)
                    : undefined;
                  const href = slug ? `/learn/${slug}` : "/instructor/enrollments";
                  return (
                    <li key={ev.id.toString()} className="relative flex gap-3">
                      <UserAvatar
                        name={ev.user?.displayName}
                        size="sm"
                        className="z-[1] shrink-0"
                      />
                      <Link href={href} className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm">
                          <span className="font-medium">
                            {ev.user?.displayName ?? "—"}
                          </span>{" "}
                          <span className="text-muted">{label}</span>
                        </p>
                        {courseTitle && (
                          <span className="chip-brand mt-1 inline-flex text-[11px]">
                            {courseTitle}
                          </span>
                        )}
                        <p className="mt-1 text-xs text-faint">
                          {courseTitle ? "· " : ""}
                          {formatAgo(ev.occurredAt)}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function StatTile({
  icon: Icon,
  iconBg,
  iconFg,
  value,
  label,
}: {
  icon: LucideIcon;
  iconBg: string;
  iconFg: string;
  value: number;
  label: string;
}) {
  return (
    <div className="card flex items-center gap-3 p-4">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${iconBg} ${iconFg}`}
        aria-hidden
      >
        <Icon size={18} strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <p className="text-xl font-bold leading-none">{value}</p>
        <p className="mt-0.5 truncate text-xs text-muted">{label}</p>
      </div>
    </div>
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
