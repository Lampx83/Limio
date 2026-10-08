import BadgeIcon from "@/components/ui/BadgeIcon";
import { Award, BookOpen, CheckCircle2, Target } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { getCourseProgress } from "@feedbackme/core-lms";
import { getLearnerSkillStates } from "@feedbackme/core-feedback";
import { getLeaderboard } from "@feedbackme/core-gamification";
import { LearningEventType, masteryLabel } from "@feedbackme/shared-types";
import { auth } from "@/lib/auth";
import { formatDate, toDayKey } from "@/lib/datetime";
import MasteryBadge from "@/components/MasteryBadge";
import HelpTour from "@/components/HelpTour";
import { LEARNER_TOUR_STEPS, hasSeenHelpTour, type HelpTourCompletionMap } from "@/lib/helpTour";
import { STUDENT_MENU_TOGGLE_EVENT } from "@/components/StudentLeftMenu";
import { getActiveRole } from "@/lib/active-role";
import CalendarLoader from "@/components/calendar/CalendarLoader";
import LearnerTodoPanel from "@/components/todo/LearnerTodoPanel";
import { loadLearnerTodo } from "@/lib/learnerTodo";

export const dynamic = "force-dynamic";

export default async function LearnerDashboard({
  searchParams,
}: {
  searchParams: { tour?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/me/dashboard");
  const userId = session.user.id;

  // Chỉ hiện help tour cho workspace Học viên — trang này cũng phục vụ role
  // "mentor" (xem ROLE_DEFAULT_PATH), scope hiện tại (CLAUDE.md §6) chỉ chốt
  // cho học viên nên bỏ qua mentor thay vì đoán nội dung phù hợp cho họ.
  const activeRole = getActiveRole(session.user.roles ?? []);
  const isLearnerWorkspace = activeRole === "learner";
  const now = new Date();

  // Các truy vấn dưới đây độc lập nhau → chạy song song. Trước đây ~10 await
  // nối tiếp nên thời gian vào trang = tổng độ trễ DB của từng truy vấn, và đây
  // là trang người học hạ cánh ngay sau khi đăng nhập.
  const [
    meTour,
    { enrollments, progressByCourse },
    xpByCourse,
    allSkillStates,
    recentBadges,
    // Việc cần làm (bài tập + quiz chưa nộp, có hạn lẫn không hạn) cho khu "Việc cần làm".
    todoItems,
    recentResolved,
    weeklyBoard,
  ] = await Promise.all([
    isLearnerWorkspace
      ? prisma.user.findUniqueOrThrow({
          where: { id: userId },
          select: { helpTourCompletedByRole: true },
        })
      : null,
    // Tiến độ từng khoá phụ thuộc danh sách ghi danh nên 2 bước này nối nhau,
    // nhưng cả chuỗi vẫn chạy song song với các truy vấn khác.
    (async () => {
      const enrollments = await prisma.enrollment.findMany({
        where: { userId },
        include: { course: { select: { id: true, slug: true, title: true } } },
        orderBy: { enrolledAt: "desc" },
      });
      const progressByCourse = await Promise.all(
        enrollments.map((e) => getCourseProgress(userId, e.course.id)),
      );
      return { enrollments, progressByCourse };
    })(),
    prisma.userCourseProgress.findMany({ where: { userId } }),
    getLearnerSkillStates(userId, undefined),
    prisma.userBadge.findMany({
      where: { userId },
      orderBy: { earnedAt: "desc" },
      take: 5,
      include: { badge: { select: { code: true, name: true } } },
    }),
    loadLearnerTodo(userId, now),
    prisma.learningEvent.findMany({
      where: { userId, eventType: LearningEventType.MisconceptionResolved },
      orderBy: { occurredAt: "desc" },
      take: 5,
    }),
    getLeaderboard({
      scope: "global",
      period: "weekly",
      viewerId: userId,
      limit: 5,
    }),
  ]);

  const shouldShowTour =
    meTour != null &&
    (searchParams?.tour === "1" ||
      !hasSeenHelpTour(meTour.helpTourCompletedByRole as HelpTourCompletionMap | null, "learner"));

  const xpMap = new Map(xpByCourse.map((x) => [x.courseId, x]));
  const weakSkills = allSkillStates
    .filter((s) => masteryLabel(s.masteryProbability) === "needs_review")
    .slice(0, 5);
  const masteredSkills = allSkillStates.filter(
    (s) => masteryLabel(s.masteryProbability) === "solid",
  ).length;

  // "Continue learning" — most-recent in-progress enrollment with lastLessonId.
  const continueTarget = enrollments
    .map((e, i) => ({ e, p: progressByCourse[i]! }))
    .filter((x) => x.e.lastLessonId && x.p.courseCompletionPct < 100)[0];

  const totalLessons = progressByCourse.reduce((s, p) => s + p.totalLessons, 0);
  const completedLessons = progressByCourse.reduce((s, p) => s + p.completedLessons, 0);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
      {/* Greeting */}
      <header>
        <span className="chip-brand">Học viên</span>
        <h1 className="mt-3 h-display text-3xl font-bold sm:text-4xl">
          Xin chào,{" "}
          <span className="text-gradient">
            {session.user.name ?? session.user.email}
          </span>{" "}
                  </h1>
        <p className="mt-2 text-muted">Tổng quan tiến độ học của bạn.</p>
      </header>

      {/*
        Chưa ghi danh khoá nào thì nói thẳng ngay ở đây, đừng để người học bấm
        vào một bài rồi bị đá về trang giới thiệu mà không hiểu vì sao. Trang
        này là nơi họ hạ cánh ngay sau khi đăng nhập, nên là chỗ đúng để nói.
      */}
      {enrollments.length === 0 && (
        <div className="banner-brand mt-6 block rounded-2xl px-5 py-4">
          <p className="font-semibold">Bạn chưa ghi danh khoá học nào</p>
          <p className="mt-1 text-sm">
            Ghi danh là bước đầu tiên để mở bài học, bài tập và bài kiểm tra —
            kể cả với khoá miễn phí. Nếu giảng viên đã gửi link mời, bấm vào
            đó là vào lớp ngay. Chưa có link? Ghé danh mục khoá học để tìm
            khoá phù hợp và đăng ký nhé.
          </p>
          <Link href="/catalog" className="btn-primary btn-sm mt-3 inline-block">
            Xem danh mục khoá học
          </Link>
        </div>
      )}

      {/* Continue learning hero CTA */}
      {continueTarget && (
        <Link
          href={`/learn/${continueTarget.e.course.slug}/lessons/${continueTarget.e.lastLessonId}`}
          className="group relative mt-6 block overflow-hidden rounded-2xl bg-brand-gradient p-4 text-white shadow-card-hover transition-transform hover:-translate-y-0.5 sm:p-5"
        >
          <div
            className="absolute inset-0 bg-hero-grid opacity-20"
            style={{ backgroundSize: "20px 20px" }}
            aria-hidden
          />
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide backdrop-blur">
                Tiếp tục học
              </span>
              <p className="mt-2 h-display text-xl font-bold sm:text-2xl">
                {continueTarget.e.course.title}
              </p>
              <div className="mt-3 flex items-center gap-3">
                <div className="h-2 w-48 overflow-hidden rounded-full bg-white/25">
                  <div
                    className="h-full rounded-full bg-white transition-all"
                    style={{ width: `${continueTarget.p.courseCompletionPct}%` }}
                  />
                </div>
                <span className="text-sm font-medium tabular-nums">
                  {continueTarget.p.courseCompletionPct}%
                </span>
              </div>
            </div>
            <span className="text-2xl transition-transform group-hover:translate-x-2">
              →
            </span>
          </div>
        </Link>
      )}

      {/* KPI cards */}
      <div data-tour="help-tour-kpis" className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {/* Bốn thẻ cùng một kiểu: cùng màu số, cùng có biểu tượng. Trước đây chỉ
            một thẻ có biểu tượng và số "Chủ đề vững" tô cam, nên sinh viên đọc
            thành cảnh báo dù đó là con số tốt. */}
        <Stat
          label="Khóa đã đăng ký"
          value={enrollments.length}
          icon={<BookOpen size={18} aria-hidden />}
          href="/me/enrollments"
        />
        <Stat
          label="Bài đã hoàn thành"
          value={`${completedLessons}/${totalLessons}`}
          icon={<CheckCircle2 size={18} aria-hidden />}
        />
        <Stat
          label="Chủ đề vững"
          value={masteredSkills}
          icon={<Target size={18} aria-hidden />}
          href="/me/skills"
        />
        <Stat
          label="Huy hiệu"
          value={recentBadges.length}
          icon={<Award size={18} aria-hidden />}
          href="/me/badges"
        />
      </div>



      <div className="mt-10 grid gap-8 lg:grid-cols-2 lg:items-start">
        {/* Hai cột độc lập ở lg (không ép cùng chiều cao hàng); dưới lg "contents" trả các ô về lưới 1 cột theo thứ tự order-*. */}
        <div className="contents lg:flex lg:flex-col lg:gap-8">
          {/* Enrolled courses */}
          <section className="card order-1 lg:order-none">
            <header className="flex items-baseline justify-between border-b border-token pb-3">
              <h2 className="text-base font-semibold">Khóa đã đăng ký</h2>
              <span className="text-xs text-faint">{enrollments.length}</span>
            </header>
            {enrollments.length === 0 ? (
              <p className="mt-4 text-sm text-muted">
                Chưa có khóa nào.{" "}
                <Link href="/catalog" className="link">
                  Vào danh mục khoá học
                </Link>
                .
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {enrollments.slice(0, 5).map((e, i) => {
                  const p = progressByCourse[i]!;
                  const xp = xpMap.get(e.course.id);
                  const pct = p.courseCompletionPct;
                  const done = pct >= 100;
                  const notStarted = pct <= 0;
                  const inProgress = !done && !notStarted;

                  const rail = done
                    ? "bg-success-500"
                    : inProgress
                      ? "bg-gradient-to-b from-brand-500 to-brand-700"
                      : "bg-[rgb(var(--surface-muted))]";
                  const headerBg = done
                    ? "bg-success-50"
                    : inProgress
                      ? "bg-brand-50"
                      : "bg-[rgb(var(--surface-muted))]";
                  const titleColor = done
                    ? "text-success-700"
                    : inProgress
                      ? "text-brand-700"
                      : "text-token";

                  return (
                    <li key={e.id}>
                      <Link
                        href={`/learn/${e.course.slug}`}
                        className="group relative block overflow-hidden rounded-xl border border-token transition-colors hover:border-brand-300"
                        prefetch={false}
                      >
                        <span className={`absolute inset-y-0 left-0 w-1 ${rail}`} aria-hidden />
                        <div className={`flex items-center justify-between gap-2 pl-4 pr-3 py-2 ${headerBg}`}>
                          <p className={`font-medium transition-colors ${titleColor}`}>
                            {e.course.title}
                          </p>
                          {done ? (
                            <span className="chip-success shrink-0">✓ Hoàn thành</span>
                          ) : inProgress ? (
                            <span className="shrink-0 rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                              Đang học
                            </span>
                          ) : (
                            <span className="shrink-0 text-[11px] font-medium text-faint">
                              Chưa bắt đầu
                            </span>
                          )}
                        </div>
                        <div className="pl-4 pr-3 py-3">
                          <div className="flex items-center gap-2 text-xs text-faint">
                            <span>{pct}% hoàn thành</span>
                            {xp && (
                              <>
                                <span>·</span>
                                <span>L{xp.level} · {xp.xp} XP</span>
                              </>
                            )}
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[rgb(var(--surface-muted))]">
                            <div
                              className={`h-1.5 rounded-full transition-all ${
                                done
                                  ? "bg-success-500"
                                  : "bg-gradient-to-r from-brand-500 to-brand-700"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Recent badges */}
          <section className="card order-3 lg:order-none">
            <header className="flex items-baseline justify-between border-b border-token pb-3">
              <h2 className="text-base font-semibold">Huy hiệu gần đây</h2>
              <Link href="/me/badges" className="link text-sm">
                Tất cả →
              </Link>
            </header>
            {recentBadges.length === 0 ? (
              <p className="mt-4 text-sm text-muted">Chưa có huy hiệu nào.</p>
            ) : (
              <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {recentBadges.map((b) => (
                  <li
                    key={b.id}
                    title={b.badge.name}
                    className="rounded-xl border border-accent-200 bg-accent-50 p-3 text-center"
                  >
                    <BadgeIcon code={b.badge.code} className="mx-auto h-20 w-20" />
                    <div className="mt-1 truncate text-xs font-medium text-accent-700">
                      {b.badge.name}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Weak topics (B1.5) */}
          <section className="card order-4 lg:order-none">
            <header className="flex items-baseline justify-between border-b border-token pb-3">
              <h2 className="text-base font-semibold">Chủ đề cần ôn</h2>
              <Link href="/me/skills" className="link text-sm">
                Bản đồ chủ đề →
              </Link>
            </header>
            {weakSkills.length === 0 ? (
              <p className="mt-4 text-sm text-muted">
                Chưa có chủ đề nào yếu rõ rệt — tiếp tục học để hệ thống đánh giá!
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {weakSkills.map((s) => (
                  <li
                    key={s.skillId}
                    className="flex items-center gap-2 rounded-lg border border-danger-100 bg-danger-50 px-3 py-2 text-sm"
                  >
                    <span className="flex-1 font-medium text-danger-700">
                      {s.skillName}
                    </span>
                    <MasteryBadge label={masteryLabel(s.masteryProbability)} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <div className="contents lg:flex lg:flex-col lg:gap-8">
          {/* Lịch tuần/tháng (cột phải, cạnh Khóa đã đăng ký): đánh dấu hạn nộp bài tập, chip chi tiết bên dưới.
              self-start để thẻ co theo nội dung, không kéo dãn bằng ô Khóa đã đăng ký. */}
          <div className="order-2 space-y-8 lg:order-none">
            <CalendarLoader userId={userId} audience="learner" />
            {/* Việc cần làm (top 5 việc có hạn, thống kê, khu không hạn, xem đủ + phân trang): ngay dưới lịch để
                việc cần hành động nhất nằm trong tầm mắt, không chôn ở hàng dưới. */}
            <LearnerTodoPanel todayKey={toDayKey(now)} items={todoItems} />
          </div>

          {/* Weekly leaderboard widget */}
          <section className="card order-5 lg:order-none">
            <header className="flex items-baseline justify-between border-b border-token pb-3">
              <h2 className="text-base font-semibold">BXH tuần này</h2>
              <Link href="/leaderboard" className="link text-sm">
                Xem tất cả →
              </Link>
            </header>
            {weeklyBoard.selfOptedOut ? (
              <p className="mt-4 text-sm text-muted">
                Bạn đang ẩn khỏi BXH.{" "}
                <Link href="/me/settings" className="link">
                  Bật lại
                </Link>
                .
              </p>
            ) : weeklyBoard.entries.length === 0 ? (
              <p className="mt-4 text-sm text-muted">Chưa có ai có XP tuần này.</p>
            ) : (
              <>
                <ul className="mt-4 space-y-2">
                  {weeklyBoard.entries.map((e) => (
                    <li
                      key={e.userId}
                      className={
                        e.isYou
                          ? "flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm"
                          : "flex items-center gap-3 rounded-lg border border-token px-3 py-2 text-sm"
                      }
                    >
                      <span className="w-6 text-center font-mono text-xs font-semibold tabular-nums text-faint">
                        #{e.rank}
                      </span>
                      <span className="flex-1 truncate font-medium">
                        {e.displayName}
                        {e.isYou && (
                          <span className="ml-2 chip-brand text-[10px]">Bạn</span>
                        )}
                      </span>
                      <span className="font-mono text-xs font-semibold tabular-nums text-brand-700">
                        {e.xp.toLocaleString("vi-VN")} XP
                      </span>
                    </li>
                  ))}
                </ul>
                {weeklyBoard.me &&
                  !weeklyBoard.entries.some((e) => e.isYou) && (
                    <div className="mt-3 flex items-center gap-3 rounded-lg border border-dashed border-brand-200 bg-brand-50/50 px-3 py-2 text-sm">
                      <span className="w-6 text-center font-mono text-xs font-semibold tabular-nums text-brand-700">
                        #{weeklyBoard.me.rank}
                      </span>
                      <span className="flex-1 font-medium text-brand-700">Bạn</span>
                      <span className="font-mono text-xs font-semibold tabular-nums text-brand-700">
                        {weeklyBoard.me.xp.toLocaleString("vi-VN")} XP
                      </span>
                    </div>
                  )}
              </>
            )}
          </section>
        </div>

        {/* Recent misconception resolutions full-width */}
        {recentResolved.length > 0 && (
          <section className="card lg:col-span-2">
            <header className="flex items-baseline justify-between border-b border-token pb-3">
              <h2 className="text-base font-semibold">
                Khắc phục lỗi tư duy gần đây
              </h2>
              <span className="text-xs text-faint">{recentResolved.length}</span>
            </header>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {recentResolved.map((e) => {
                const p = e.payload as {
                  misconceptionCode?: string;
                  misconceptionId?: string;
                };
                return (
                  <li
                    key={String(e.id)}
                    className="flex items-center gap-2 rounded-lg border border-success-100 bg-success-50 px-3 py-2 text-sm"
                  >
                    <span className="text-success-600">✓</span>
                    <span className="flex-1 font-mono text-xs text-success-700">
                      {p.misconceptionCode ?? "—"}
                    </span>
                    <span className="text-xs text-success-700/70">
                      {formatDate(e.occurredAt)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
      {shouldShowTour && (
        <HelpTour
          steps={LEARNER_TOUR_STEPS}
          role="learner"
          initiallyOpen
          mobileMenuToggleEvent={STUDENT_MENU_TOGGLE_EVENT}
        />
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  icon,
  href,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  href?: string;
}) {
  const inner = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-brand-600">{icon}</span>
        <span className="h-display text-2xl font-bold tabular-nums text-brand-600">
          {value}
        </span>
      </div>
      <div className="mt-1 text-xs text-muted sm:text-sm">{label}</div>
    </>
  );
  return href ? (
    <Link href={href} className="card-hover block">
      {inner}
    </Link>
  ) : (
    <div className="card">{inner}</div>
  );
}
