import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { prisma } from "@feedbackme/db";
import { getCourseProgress, isUserEnrolled } from "@feedbackme/core-lms";
import {
  getClearedChampionsLeaderboard,
  getCourseXpProgress,
  getDailyQuestsForUser,
  getLeaderboard,
  getStreak,
  listBadgeCatalog,
  listUserBadges,
} from "@feedbackme/core-gamification";
import { getAdaptiveNextLesson } from "@feedbackme/core-feedback";
import { auth } from "@/lib/auth";
import { StickyMobileCTA } from "@/components/ui";
import CourseLeaderboardCard from "@/components/CourseLeaderboardCard";
import PaymentProcessingNotice from "@/components/PaymentProcessingNotice";

export const dynamic = "force-dynamic";

export default async function LearnCoursePage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams?: { paid?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect(`/signin?callbackUrl=/learn/${params.slug}`);

  const course = await prisma.course.findUnique({
    where: { slug: params.slug },
    include: {
      modules: {
        orderBy: { orderIndex: "asc" },
        include: { lessons: { orderBy: { orderIndex: "asc" } } },
      },
    },
  });
  if (!course) notFound();

  if (!(await isUserEnrolled(session.user.id, course.id))) {
    // Vừa quay về từ Stripe checkout — webhook checkout.session.completed
    // chạy song song với redirect, có thể chưa kịp tạo Enrollment. Đừng bounce
    // thẳng về catalog?locked=1 (trông như thanh toán thất bại) — chờ vài
    // giây và tự polling thay vì bắt học viên tự tải lại.
    if (searchParams?.paid === "1") {
      return <PaymentProcessingNotice slug={params.slug} />;
    }
    redirect(`/catalog/${params.slug}?locked=1`);
  }

  // Enrollment gate đã chạy ở trên (isUserEnrolled) nên các query dưới đây độc
  // lập với nhau — gộp Promise.all để rút ngắn thời gian loading.tsx hiển thị
  // thay vì nối đuôi 8 round-trip DB/service tuần tự.
  const [
    enrollment,
    progress,
    xp,
    streak,
    weeklyLeaderboard,
    allTimeLeaderboard,
    champions,
    dailyQuests,
    adaptiveNext,
    catalog,
    earned,
  ] = await Promise.all([
    prisma.enrollment.findUniqueOrThrow({
      where: { userId_courseId: { userId: session.user.id, courseId: course.id } },
    }),
    getCourseProgress(session.user.id, course.id),
    getCourseXpProgress(session.user.id, course.id),
    getStreak(session.user.id, course.id),
    getLeaderboard({ scope: "course", period: "weekly", courseId: course.id, viewerId: session.user.id, limit: 8 }),
    getLeaderboard({ scope: "course", period: "all_time", courseId: course.id, viewerId: session.user.id, limit: 8 }),
    getClearedChampionsLeaderboard(course.id, session.user.id),
    getDailyQuestsForUser(session.user.id),
    getAdaptiveNextLesson(session.user.id, course.id),
    listBadgeCatalog(),
    listUserBadges(session.user.id),
  ]);
  const earnedCodes = new Set(earned.map((u) => u.badge.code));
  const completedSet = new Set(
    progress.modules.flatMap((m) => m.lessons.filter((l) => l.completed).map((l) => l.id)),
  );

  const isComplete = progress.courseCompletionPct >= 100;

  const continueLessonId = enrollment.lastLessonId || adaptiveNext?.lessonId;
  const continueLabel = enrollment.lastLessonId ? "Tiếp tục" : adaptiveNext ? "Đề xuất" : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 lg:px-6 pb-28 lg:pb-10">
      {/* Breadcrumb */}
      <Link
        href={`/catalog/${params.slug}`}
        className="link inline-flex items-center gap-1 text-sm"
      >
        ← Course detail
      </Link>

      {/* Hero header */}
      <header className="relative mt-4 overflow-hidden rounded-2xl bg-brand-gradient p-6 text-white shadow-card-hover sm:p-8">
        <div className="absolute inset-0 bg-hero-grid opacity-20" style={{ backgroundSize: "20px 20px" }} aria-hidden />
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium backdrop-blur">
                {course.level} · {course.language}
              </span>
              <h1 className="mt-3 h-display text-3xl font-bold sm:text-4xl">
                {course.title}
              </h1>
            </div>
            {streak.currentStreak > 0 && (
              <div
                className="flex items-center gap-2 rounded-xl bg-accent-500/95 px-3 py-2 text-sm font-semibold shadow-sm"
                title={`Kỷ lục dài nhất: ${streak.longestStreak} ngày`}
              >
                <span aria-hidden className="text-lg leading-none">🔥</span>
                <span>
                  {streak.currentStreak} ngày
                  {streak.isActiveToday && (
                    <span className="ml-1 text-xs opacity-80">· hôm nay ✓</span>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Progress + XP */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <ProgressTile
              label="Tiến độ học"
              value={`${progress.courseCompletionPct}%`}
              pct={progress.courseCompletionPct}
              barClass="bg-white"
              tone="white"
            />
            <ProgressTile
              label="Điểm tương tác"
              value={`${xp.xp} XP`}
              hint={
                xp.isMaxLevel
                  ? `Level ${xp.level} · ${xp.levelName} (tối đa)`
                  : `Level ${xp.level} · ${xp.levelName} — +${xp.xpToNext} → L${xp.level + 1}`
              }
              pct={xp.levelProgressPct}
              barClass="bg-accent-300"
              tone="white"
              action={
                <Link
                  href="/xp-guide"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-xs font-medium text-white backdrop-blur transition-colors hover:bg-white/30"
                >
                  💡 Cách tính điểm
                </Link>
              }
            />
          </div>

          {/* Action buttons */}
          <div className="mt-5 flex flex-wrap gap-2">
            {enrollment.lastLessonId && (
              <Link
                href={`/learn/${params.slug}/lessons/${enrollment.lastLessonId}`}
                className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-brand-700 shadow-sm transition-all hover:scale-[1.02]"
              >
                Tiếp tục bài gần nhất
              </Link>
            )}
            {adaptiveNext && (
              <Link
                href={`/learn/${params.slug}/lessons/${adaptiveNext.lessonId}`}
                className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur transition-all hover:bg-white/20"
                title={`Đề xuất: ${adaptiveNext.lessonTitle} (skill yếu: ${adaptiveNext.weakestSkillName} ${Math.round(
                  adaptiveNext.masteryProbability * 100,
                )}%)`}
              >
                <span aria-hidden>✨</span>
                <span className="hidden sm:inline">Đề xuất: {adaptiveNext.lessonTitle}</span>
                <span className="sm:hidden">Đề xuất</span>
              </Link>
            )}
            {isComplete && (
              <Link
                href={`/learn/${params.slug}/certificate`}
                className="inline-flex items-center gap-2 rounded-lg border-2 border-accent-300 bg-accent-400/20 px-4 py-2 text-sm font-semibold backdrop-blur transition-all hover:bg-accent-400/30"
              >
                Xem chứng nhận
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Content grid */}
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          {/* Modules */}
          <section>
            <div className="flex items-baseline justify-between">
              <h2 className="text-xl font-semibold">Lộ trình học</h2>
              <span className="text-xs text-faint">
                {
                  course.modules
                    .flatMap((m) => m.lessons)
                    .filter((l) => !l.isHidden && completedSet.has(l.id)).length
                }
                /
                {
                  course.modules
                    .flatMap((m) => m.lessons)
                    .filter((l) => !l.isHidden).length
                }{" "}
                bài đã hoàn thành
              </span>
            </div>
            <ol className="mt-4 space-y-4">
              {course.modules
                .filter((m) => !m.isHidden)
                .map((m) => {
                  const visibleLessons = m.lessons.filter((l) => !l.isHidden);
                  const done = visibleLessons.filter((l) =>
                    completedSet.has(l.id)
                  ).length;

                  const pct =
                    visibleLessons.length > 0
                      ? Math.round((done / visibleLessons.length) * 100)
                      : 0;
                  return (
                    <li key={m.id} className="card">
                    <header className="border-b border-token pb-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="font-semibold">
                          <span className="mr-2 text-faint">Module</span>
                          {m.title}
                        </h3>
                        <span className="text-xs text-faint tabular-nums">
                          {done}/{visibleLessons.length} ·{" "}
                          <span className={pct === 100 ? "text-success-600 font-semibold" : ""}>
                            {pct}%
                          </span>
                        </span>
                      </div>
                      <div
                        className="mt-2 h-1.5 overflow-hidden rounded-full bg-[rgb(var(--surface-muted))]"
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div
                          className={`h-full rounded-full transition-all ${
                            pct === 100
                              ? "bg-success-500"
                              : "bg-gradient-to-r from-brand-500 to-brand-600"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </header>
                    <ol className="mt-3 space-y-1.5">
                      {m.lessons.map((l, li) => {
                        if (l.isHidden) return null;

                        const completed = completedSet.has(l.id);
                        const locked = m.isLocked || l.isLocked;

                        // B14 — khoá thì vẫn thấy tên bài (để biết lộ trình còn
                        // gì) nhưng không phải liên kết: bấm vào rồi mới bị chặn
                        // chỉ làm người học tưởng mình bấm hỏng.
                        if (locked) {
                          return (
                            <li key={l.id}>
                              <div
                                className="flex cursor-not-allowed items-center gap-3 rounded-lg px-2 py-1.5 text-faint"
                                title="Nội dung đang khoá — giảng viên sẽ mở sau"
                              >
                                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--surface-muted))]">
                                  <Lock className="h-3 w-3" aria-hidden />
                                </span>
                                <span className="flex-1 text-sm">{l.title}</span>
                                <span className="text-[10px] uppercase tracking-wide">
                                  Đang khoá
                                </span>
                              </div>
                            </li>
                          );
                        }

                        return (
                          <li key={l.id}>
                            <Link
                              href={`/learn/${params.slug}/lessons/${l.id}`}
                              className="group flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-[rgb(var(--surface-muted))]"
                              prefetch={false}
                            >
                              <span
                                className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                                  completed
                                    ? "bg-success-500 text-white"
                                    : "bg-[rgb(var(--surface-muted))] text-muted"
                                }`}
                              >
                                {completed ? "✓" : li + 1}
                              </span>
                              <span
                                className={`flex-1 text-sm transition-colors group-hover:text-brand-600 ${
                                  completed ? "text-muted line-through" : ""
                                }`}
                              >
                                {l.title}
                              </span>
                              <span className="text-xs text-faint opacity-0 transition-opacity group-hover:opacity-100">
                                →
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ol>
                  </li>
                );
              })}
            </ol>
          </section>

          {isComplete && (
            <div className="rounded-2xl border border-success-100 bg-success-50 p-5 text-center">
              <p className="text-2xl"></p>
              <p className="mt-1 font-semibold text-success-700">
                Bạn đã hoàn thành khóa học này!
              </p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-5">
          {/* Daily quests */}
          {dailyQuests.length > 0 && (
            <section className="card">
              <h2 className="text-base font-semibold">Nhiệm vụ hôm nay</h2>
              <ul className="mt-4 space-y-3">
                {dailyQuests.map((q) => {
                  const pct = Math.min(100, Math.round((q.count / q.target) * 100));
                  return (
                    <li
                      key={q.id}
                      title={q.description}
                      className={`rounded-lg border p-3 ${
                        q.completed
                          ? "border-success-100 bg-success-50"
                          : "border-token"
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-medium leading-tight">
                          {q.emoji} {q.name}
                        </p>
                        <span className="chip-accent shrink-0">+{q.rewardXp} XP</span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-[rgb(var(--surface-muted))]">
                        <div
                          className={`h-1.5 rounded-full transition-all ${
                            q.completed
                              ? "bg-success-500"
                              : "bg-gradient-to-r from-brand-500 to-brand-700"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-1.5 text-xs text-faint">
                        {q.completed ? "✓ Đã hoàn thành" : `${q.count} / ${q.target}`}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Leaderboard */}
          <CourseLeaderboardCard
            courseId={course.id}
            weekly={weeklyLeaderboard}
            allTime={allTimeLeaderboard}
          />

          {/* Champions */}
          {champions.entries.length > 0 && (
            <section className="card">
              <div className="flex items-baseline justify-between">
                <h2 className="text-base font-semibold">Champions</h2>
                <span className="text-xs text-faint">
                  {champions.lookbackDays} ngày
                </span>
              </div>
              <p className="mt-1 text-xs text-faint">Khắc phục lỗi tư duy</p>
              <ol className="mt-3 space-y-1">
                {champions.entries.map((e) => (
                  <li
                    key={e.userId}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${
                      e.isYou
                        ? "bg-success-50 font-semibold text-success-700"
                        : ""
                    }`}
                  >
                    <span className="w-6 shrink-0 text-right tabular-nums text-faint">
                      {e.rank === 1
                        ? ""
                        : e.rank === 2
                          ? ""
                          : e.rank === 3
                            ? ""
                            : `#${e.rank}`}
                    </span>
                    <span className="flex-1 truncate">{e.displayName}</span>
                    <span className="text-xs font-medium tabular-nums text-success-600">
                      {e.resolvedCount}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* Badges */}
          <section className="card">
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-semibold">Huy hiệu</h2>
              <span className="text-xs text-faint">
                {earnedCodes.size}/{catalog.length}
              </span>
            </div>
            <ul className="mt-3 grid grid-cols-3 gap-2">
              {catalog.map((b) => {
                const isEarned = earnedCodes.has(b.code);
                return (
                  <li
                    key={b.code}
                    title={b.description}
                    className={`rounded-lg border p-2 text-center transition ${
                      isEarned
                        ? "border-accent-200 bg-accent-50"
                        : "border-token bg-[rgb(var(--surface-muted))]"
                    }`}
                  >
                    {isEarned ? (
                      <div className="text-xl">{b.emoji ?? ""}</div>
                    ) : (
                      <Lock className="mx-auto h-4 w-4 text-faint" aria-hidden />
                    )}
                    <div className="mt-0.5 text-[10px] font-medium leading-tight">
                      {b.name}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>
      </div>

      {continueLessonId && continueLabel && (
        <StickyMobileCTA
          primary={`${continueLabel} bài học`}
          secondary={`${progress.courseCompletionPct}% hoàn thành · ${xp.xp} XP`}
          action={
            <Link
              href={`/learn/${params.slug}/lessons/${continueLessonId}`}
              className="btn-primary"
            >
              Vào học →
            </Link>
          }
        />
      )}
    </main>
  );
}

function ProgressTile({
  label,
  value,
  hint,
  pct,
  barClass,
  tone,
  action,
}: {
  label: string;
  value: string;
  hint?: string | null;
  pct: number;
  barClass: string;
  tone: "white";
  action?: React.ReactNode;
}) {
  void tone;
  return (
    <div className="rounded-xl bg-white/15 p-3 backdrop-blur">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
          {label}
        </p>
        <p className="text-sm font-bold tabular-nums">{value}</p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/25">
        <div
          className={`h-2 rounded-full transition-all ${barClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {(hint || action) && (
        <div className="mt-1 flex items-center justify-between gap-2">
          {hint && <p className="text-xs opacity-75">{hint}</p>}
          {action}
        </div>
      )}
    </div>
  );
}
