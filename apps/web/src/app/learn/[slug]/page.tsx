import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { getCourseProgress, isUserEnrolled } from "@feedbackme/core-lms";
import {
  getClearedChampionsLeaderboard,
  getCourseLeaderboard,
  getCourseXpProgress,
  getDailyQuestsForUser,
  getStreak,
  listBadgeCatalog,
  listUserBadges,
} from "@feedbackme/core-gamification";
import { getAdaptiveNextLesson } from "@feedbackme/core-feedback";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LearnCoursePage({ params }: { params: { slug: string } }) {
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
    redirect(`/catalog/${params.slug}`);
  }

  const enrollment = await prisma.enrollment.findUniqueOrThrow({
    where: { userId_courseId: { userId: session.user.id, courseId: course.id } },
  });
  const progress = await getCourseProgress(session.user.id, course.id);
  const xp = await getCourseXpProgress(session.user.id, course.id);
  const streak = await getStreak(session.user.id, course.id);
  const leaderboard = await getCourseLeaderboard(course.id, session.user.id);
  const champions = await getClearedChampionsLeaderboard(course.id, session.user.id);
  const dailyQuests = await getDailyQuestsForUser(session.user.id);
  const adaptiveNext = await getAdaptiveNextLesson(session.user.id, course.id);
  const [catalog, earned] = await Promise.all([
    listBadgeCatalog(),
    listUserBadges(session.user.id),
  ]);
  const earnedCodes = new Set(earned.map((u) => u.badge.code));
  const completedSet = new Set(
    progress.modules.flatMap((m) => m.lessons.filter((l) => l.completed).map((l) => l.id)),
  );

  const isComplete = progress.courseCompletionPct >= 100;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
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
                <span className="text-lg"></span>
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
              label={`Level ${xp.level} · ${xp.levelName}`}
              value={`${xp.xp} XP`}
              hint={
                xp.isMaxLevel ? null : `+${xp.xpToNext} → L${xp.level + 1}`
              }
              pct={xp.levelProgressPct}
              barClass="bg-accent-300"
              tone="white"
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
                title={`Skill yếu nhất: ${adaptiveNext.weakestSkillName} (${Math.round(
                  adaptiveNext.masteryProbability * 100,
                )}%)`}
              >
                Đề xuất: {adaptiveNext.lessonTitle}
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
                {progress.completedLessons}/{progress.totalLessons} bài đã hoàn thành
              </span>
            </div>
            <ol className="mt-4 space-y-4">
              {course.modules.map((m, mi) => {
                const total = m.lessons.length;
                const done = m.lessons.filter((l) => completedSet.has(l.id)).length;
                return (
                  <li key={m.id} className="card">
                    <header className="flex items-baseline justify-between gap-3 border-b border-token pb-3">
                      <h3 className="font-semibold">
                        <span className="mr-2 text-faint">Module {mi + 1}</span>
                        {m.title}
                      </h3>
                      <span className="text-xs text-faint tabular-nums">
                        {done}/{total}
                      </span>
                    </header>
                    <ol className="mt-3 space-y-1.5">
                      {m.lessons.map((l, li) => {
                        const completed = completedSet.has(l.id);
                        return (
                          <li key={l.id}>
                            <Link
                              href={`/learn/${params.slug}/lessons/${l.id}`}
                              className="group flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-[rgb(var(--surface-muted))]"
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
          <section className="card">
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-semibold">BXH tuần</h2>
              <span className="text-xs text-faint">
                {leaderboard.totalParticipants} người
              </span>
            </div>
            {leaderboard.selfOptedOut && (
              <p className="mt-2 text-xs text-faint">
                Bạn đã tắt BXH. Bật lại trong{" "}
                <Link href="/me/settings" className="link">
                  cài đặt
                </Link>
                .
              </p>
            )}
            {leaderboard.entries.length === 0 ? (
              <p className="mt-3 text-sm text-faint">
                Chưa ai có XP tuần này. Trở thành người đầu tiên!
              </p>
            ) : (
              <ol className="mt-3 space-y-1">
                {leaderboard.entries.map((e) => (
                  <li
                    key={e.userId}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${
                      e.isYou
                        ? "bg-brand-soft font-semibold text-brand-700"
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
                    <span className="text-xs text-faint">L{e.level}</span>
                    <span className="w-14 text-right text-xs tabular-nums font-medium">
                      {e.weeklyXp} XP
                    </span>
                  </li>
                ))}
              </ol>
            )}
            {leaderboard.selfRank && (
              <p className="mt-3 rounded-lg bg-[rgb(var(--surface-muted))] px-3 py-2 text-xs">
                Bạn ở Top {leaderboard.selfRank.percentile}% ·{" "}
                {leaderboard.selfRank.weeklyXp} XP
              </p>
            )}
          </section>

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
                        : "border-dashed border-token bg-[rgb(var(--surface-muted))] opacity-50 grayscale"
                    }`}
                  >
                    <div className="text-xl">{b.emoji ?? ""}</div>
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
}: {
  label: string;
  value: string;
  hint?: string | null;
  pct: number;
  barClass: string;
  tone: "white";
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
      {hint && <p className="mt-1 text-xs opacity-75">{hint}</p>}
    </div>
  );
}
