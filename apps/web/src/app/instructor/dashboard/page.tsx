import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import {
  BookOpen,
  ClipboardList,
  FileText,
  HelpCircle,
  ListChecks,
  MessageSquare,
  Tag,
  Trophy,
  UserX,
  Users,
  type LucideIcon,
} from "lucide-react";
import { prisma } from "@feedbackme/db";
import {
  getInstructorSkillCoverage,
  listSampleCourses,
  userIsAnyProctor,
} from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import { hourVN } from "@/lib/datetime";
import FeatureBlockedToast from "@/components/FeatureBlockedToast";
import UserAvatar from "@/components/ui/UserAvatar";
import HelpTour from "@/components/HelpTour";
import { INSTRUCTOR_TOUR_STEPS, hasSeenHelpTour, type HelpTourCompletionMap } from "@/lib/helpTour";
import {
  INSTRUCTOR_MENU_TOGGLE_EVENT,
  INSTRUCTOR_MENU_PREVIEW_EVENT,
} from "@/components/InstructorLeftMenu";
import CalendarLoader from "@/components/calendar/CalendarLoader";
import TeacherAssistant from "@/components/TeacherAssistant";
import { buildStarters } from "@/lib/teacherAssistant";

export const dynamic = "force-dynamic";

const ESSAY_STALE_HOURS = 48;
const ASSIGNMENT_STALE_HOURS = 24;
const FORUM_STALE_HOURS = 48;
const LEARNER_STALE_DAYS = 14;
const ACTIVITY_FEED_HOURS = 72;
const ACTIVITY_FEED_LIMIT = 12;
/** Số việc hiện sẵn ở "Việc cần làm"; phần còn lại thu trong "Xem tất cả". */
const TOP_TASKS = 3;
const COURSES_SHOWN = 6;
const ACTIVITY_SHOWN = 6;

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
  const h = hourVN();
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

export default async function InstructorDashboard({
  searchParams,
}: {
  searchParams: { tour?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/instructor/dashboard");
  const userId = session.user.id;

  const meTour = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { helpTourCompletedByRole: true },
  });
  const shouldShowTour =
    searchParams?.tour === "1" ||
    !hasSeenHelpTour(meTour.helpTourCompletedByRole as HelpTourCompletionMap | null, "instructor");

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
    // Khoá mẫu do admin đánh dấu: cho giảng viên mới xem một khoá dựng xong trông thế nào.
    const sampleCourses = await listSampleCourses();
    return (
      <main>
        <div>
          <TeacherAssistant
          greeting={greeting()}
            name={session.user.name ?? session.user.email ?? ""}
              starters={buildStarters({
              courseTitles: [],
              pendingEssays: 0,
              pendingAssignments: 0,
              staleForumThreads: 0,
              staleLearners: 0,
            })}
          />
        </div>
        <div className="mt-6 rounded-2xl border border-accent-200 bg-accent-50 p-5">
          <p className="text-sm font-semibold text-accent-700">
            Bạn chưa là instructor của khoá nào.
          </p>
          <Link href="/instructor/courses/new" className="btn-primary mt-4 inline-flex">
            + Tạo khoá đầu tiên
          </Link>
        </div>
        {sampleCourses.length > 0 && (
          <section className="mt-8" aria-labelledby="sample-courses-heading">
            <h2 id="sample-courses-heading" className="text-base font-semibold">
              Xem khoá mẫu
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              Xem một khoá đã dựng xong trông thế nào trước khi tạo khoá của bạn.
            </p>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sampleCourses.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/catalog/${c.slug}`}
                    className="card block h-full p-4 transition-colors hover:border-brand-300"
                  >
                    <p className="font-semibold leading-snug">{c.title}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted">
                      {c.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}
                    </p>
                    <p className="mt-3 text-xs font-medium text-brand-700">Xem khoá →</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        {/* Chưa có khoá thì lịch không có gì để hiện (nó chỉ liệt kê hạn nộp của các khoá mình dạy) —
            đặt ở đây chỉ là một thẻ lạc chỗ dưới nút "Tạo khoá đầu tiên". Có khoá rồi mới hiện lịch. */}
        {shouldShowTour && (
          <HelpTour
            steps={INSTRUCTOR_TOUR_STEPS}
            role="instructor"
            initiallyOpen
            mobileMenuToggleEvent={INSTRUCTOR_MENU_TOGGLE_EVENT}
            moduleRevealEvent={INSTRUCTOR_MENU_PREVIEW_EVENT}
          />
        )}
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

  // ── Gamification theo khoá (chỉ khoá đã mở — khoá nháp không có tab này) ──
  const gamiCourses = ownedCourses.filter((c) => c.status !== "draft");
  const gamiSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const gamiSummaries = await Promise.all(
    gamiCourses.map(async (c) => {
      const [agg, active, badges] = await Promise.all([
        prisma.userCourseProgress.aggregate({
          where: { courseId: c.id },
          _sum: { xp: true },
          _count: { _all: true },
        }),
        prisma.xpTransaction.findMany({
          where: { courseId: c.id, occurredAt: { gte: gamiSince }, amount: { gt: 0 } },
          select: { userId: true },
          distinct: ["userId"],
        }),
        prisma.userBadge.count({
          where: { context: { path: ["courseId"], equals: c.id } },
        }),
      ]);
      return {
        course: c,
        totalXp: agg._sum.xp ?? 0,
        earners: agg._count._all,
        active7d: active.length,
        badges,
      };
    }),
  );

  const totalLearners = ownedCourses.reduce((s, c) => s + c._count.enrollments, 0);

  // Activity feed deep links + course tag.
  const courseSlugById = new Map(
    ownedCourses.map((c) => [c.id, c.slug] as const),
  );
  const courseTitleById = new Map(
    ownedCourses.map((c) => [c.id, c.title] as const),
  );

  const topItems = items.slice(0, TOP_TASKS);
  const moreItems = items.slice(TOP_TASKS);
  const shownCourses = ownedCourses.slice(0, COURSES_SHOWN);

  return (
    <main>
      <Suspense fallback={null}>
        <FeatureBlockedToast />
      </Suspense>

      {/* Hai cột từ lg: cột chính là việc của thầy/cô (Lily, số liệu, việc cần làm, khoá học); cột phải là thứ để
          liếc qua (lịch, hoạt động). Dưới lg xếp một cột theo đúng thứ tự đó. */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <TeacherAssistant
            greeting={greeting()}
            name={session.user.name ?? session.user.email ?? ""}
            starters={buildStarters({
              courseTitles: ownedCourses.map((c) => c.title),
              courses: ownedCourses.map((c) => ({ id: c.id, title: c.title })),
              pendingEssays: pendingEssaysTotal,
              pendingAssignments: pendingAssignmentsTotal,
              staleForumThreads,
              staleLearners: staleLearnerCount,
            })}
          />

          {/* Dải số liệu mỏng: một khối, bốn con số, không bốn thẻ riêng. */}
          <dl className="grid grid-cols-2 overflow-hidden rounded-2xl border border-token bg-[rgb(var(--surface))] sm:grid-cols-4 [&>div]:border-token [&>div:nth-child(even)]:border-l [&>div:nth-child(n+3)]:border-t sm:[&>div:not(:first-child)]:border-l sm:[&>div:nth-child(n+3)]:border-t-0">
            <StatCell icon={BookOpen} tone="text-brand-600" value={ownedCourses.length} label="Khoá học" />
            <StatCell icon={Users} tone="text-brand-600" value={totalLearners} label="Học viên" />
            <StatCell icon={ListChecks} tone="text-accent-600" value={items.length} label="Việc cần làm" />
            <StatCell icon={UserX} tone="text-danger-600" value={staleLearnerCount} label={`Im ắng >${LEARNER_STALE_DAYS} ngày`} />
          </dl>

          {/* Việc cần làm: chỉ ba việc đầu (đã sắp theo độ gấp), còn lại thu trong "Xem tất cả". */}
          <section aria-labelledby="todo-heading">
            <header className="flex items-baseline justify-between">
              <h2 id="todo-heading" className="text-base font-semibold">
                Việc cần làm hôm nay{" "}
                <span className="text-xs font-normal text-faint">({items.length})</span>
              </h2>
              <span className="text-xs text-faint">Việc gấp xếp trước</span>
            </header>
            {items.length === 0 ? (
              <div className="mt-3 rounded-2xl border border-token bg-[rgb(var(--surface))] p-6 text-center text-sm text-muted">
                Thầy/cô không có việc nào đang chờ. Tận hưởng nhé.
              </div>
            ) : (
              <>
                <ul className="mt-3 space-y-2">
                  {topItems.map((it) => (
                    <TaskRow key={it.id} item={it} />
                  ))}
                </ul>
                {moreItems.length > 0 && (
                  <details className="group mt-2">
                    <summary className="inline-flex cursor-pointer items-center gap-1 py-1 text-sm font-medium text-sky-700 underline decoration-sky-300 underline-offset-4 hover:text-sky-900 dark:text-sky-400">
                      <span className="group-open:hidden">Xem tất cả ({items.length})</span>
                      <span className="hidden group-open:inline">Thu gọn</span>
                    </summary>
                    <ul className="mt-2 space-y-2">
                      {moreItems.map((it) => (
                        <TaskRow key={it.id} item={it} />
                      ))}
                    </ul>
                  </details>
                )}
              </>
            )}
          </section>

          {/* Khoá học của tôi */}
          <section aria-labelledby="my-courses-heading">
            <header className="flex items-baseline justify-between">
              <h2 id="my-courses-heading" className="text-base font-semibold">Khoá học của tôi</h2>
              <Link href="/instructor/courses" prefetch={false} className="text-sm font-medium text-sky-700 underline decoration-sky-300 underline-offset-4 hover:text-sky-900 dark:text-sky-400">
                {ownedCourses.length > shownCourses.length ? `Xem tất cả (${ownedCourses.length})` : "Quản lý khoá học"}
              </Link>
            </header>
            <ul className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {shownCourses.map((c) => {
                const published = c.status !== "draft";
                return (
                  <li key={c.id} className="min-w-0">
                    <Link
                      href={`/instructor/courses/${c.id}`}
                      prefetch={false}
                      className="card-hover relative flex h-full items-center gap-3 overflow-hidden rounded-xl border border-token bg-[rgb(var(--surface))] py-3 pl-4 pr-3 transition-colors hover:bg-[rgb(var(--surface-muted))]"
                    >
                      <span className={`absolute inset-y-0 left-0 w-1 ${published ? "bg-brand-500" : "bg-slate-300"}`} aria-hidden />
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--brand-soft))] text-brand-600" aria-hidden>
                        <BookOpen size={18} strokeWidth={2} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 block text-sm font-bold leading-snug">{c.title}</span>
                        <span className="block text-xs text-muted">
                          {published ? "Đang mở" : "Nháp"} · {c._count.enrollments} học viên
                        </span>
                      </span>
                      <span className="shrink-0 text-sm text-faint" aria-hidden>→</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          {gamiSummaries.length > 0 && (
            <details className="group rounded-2xl border border-token bg-[rgb(var(--surface))] p-4">
              <summary className="cursor-pointer text-sm font-semibold">Gamification theo khoá</summary>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {gamiSummaries.map((g) => (
                  <Link
                    key={g.course.id}
                    href={`/instructor/courses/${g.course.id}?tab=gamification`}
                    prefetch={false}
                    className="card block p-4 transition-colors hover:border-brand-300"
                  >
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 shrink-0 text-accent-600" aria-hidden />
                      <p className="truncate text-sm font-semibold">{g.course.title}</p>
                    </div>
                    {g.earners === 0 ? (
                      <p className="mt-3 text-xs text-muted">Khoá này chưa có dữ liệu gamification.</p>
                    ) : (
                      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <div>
                          <dd className="text-lg font-bold leading-none">{g.totalXp}</dd>
                          <dt className="mt-1 text-xs text-muted">Tổng XP</dt>
                        </div>
                        <div>
                          <dd className="text-lg font-bold leading-none">{g.badges}</dd>
                          <dt className="mt-1 text-xs text-muted">Badge</dt>
                        </div>
                        <div>
                          <dd className="text-lg font-bold leading-none">{g.active7d}</dd>
                          <dt className="mt-1 text-xs text-muted">Có XP 7 ngày</dt>
                        </div>
                      </dl>
                    )}
                  </Link>
                ))}
              </div>
            </details>
          )}
        </div>

        <aside className="min-w-0 space-y-6">
          {/* Lịch + nhãn tuần của kỳ học (chỉ tài khoản thuộc trường mới có nhãn) */}
          <CalendarLoader userId={userId} audience="instructor" />

          <section aria-labelledby="activity-heading">
            <header className="flex items-baseline justify-between">
              <h2 id="activity-heading" className="text-base font-semibold">Hoạt động gần đây</h2>
              <span className="text-xs text-faint">{ACTIVITY_FEED_HOURS}h qua</span>
            </header>
            {recentActivityEvents.length === 0 ? (
              <div className="mt-3 rounded-2xl border border-token bg-[rgb(var(--surface))] p-6 text-center text-sm text-muted">
                Chưa có hoạt động.
              </div>
            ) : (
              <div className="mt-3 rounded-2xl border border-token bg-[rgb(var(--surface))] p-4">
                <ul className="space-y-3.5">
                  {recentActivityEvents.slice(0, ACTIVITY_SHOWN).map((ev) => {
                    const label = EVENT_LABEL[ev.eventType]?.(ev.payload as Record<string, unknown>) ?? ev.eventType;
                    const slug = ev.courseId ? courseSlugById.get(ev.courseId) : undefined;
                    const courseTitle = ev.courseId ? courseTitleById.get(ev.courseId) : undefined;
                    const href = slug ? `/learn/${slug}` : "/instructor/enrollments";
                    return (
                      <li key={ev.id.toString()} className="flex gap-3">
                        <UserAvatar name={ev.user?.displayName} size="sm" className="shrink-0" />
                        <Link href={href} className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm">
                            <span className="font-medium">{ev.user?.displayName ?? "—"}</span>{" "}
                            <span className="text-muted">{label}</span>
                          </p>
                          <p className="mt-0.5 truncate text-xs text-faint">
                            {courseTitle ? `${courseTitle} · ` : ""}
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
        </aside>
      </div>
      {shouldShowTour && (
        <HelpTour
          steps={INSTRUCTOR_TOUR_STEPS}
          role="instructor"
          initiallyOpen
          mobileMenuToggleEvent={INSTRUCTOR_MENU_TOGGLE_EVENT}
          moduleRevealEvent={INSTRUCTOR_MENU_PREVIEW_EVENT}
        />
      )}
    </main>
  );
}

function StatCell({
  icon: Icon,
  tone,
  value,
  label,
}: {
  icon: LucideIcon;
  tone: string;
  value: number;
  label: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 px-4 py-3">
      <Icon size={18} strokeWidth={2} className={`shrink-0 ${tone}`} aria-hidden />
      <div className="min-w-0">
        <dd className="text-lg font-bold leading-none">{value}</dd>
        <dt className="mt-0.5 truncate text-xs text-muted">{label}</dt>
      </div>
    </div>
  );
}

function TaskRow({ item }: { item: PriorityItem }) {
  const style = PRIORITY_STYLES[item.priority];
  const Icon = CATEGORY_ICON[item.category];
  return (
    <li>
      <Link
        href={item.href}
        prefetch={false}
        className={`card-hover relative flex items-center gap-3 overflow-hidden rounded-xl border border-token py-3 pl-4 pr-3 transition-colors hover:border-brand-200 ${style.cardBg}`}
      >
        <span className={`absolute inset-y-0 left-0 w-1 ${style.bar}`} aria-hidden />
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${style.iconBg} ${style.iconFg}`} aria-hidden>
          <Icon size={18} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug">{item.title}</p>
          <p className="mt-0.5 text-xs text-muted">
            <span className={`font-semibold ${style.tierLabelColor}`}>{TIER_LABEL[item.priority]}</span> · {item.detail}
          </p>
        </div>
        <span className="shrink-0 text-sm text-faint" aria-hidden>→</span>
      </Link>
    </li>
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
