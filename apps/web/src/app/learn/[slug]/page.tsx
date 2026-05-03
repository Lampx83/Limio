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

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href={`/catalog/${params.slug}`} className="text-sm underline">
        ← Course detail
      </Link>
      <h1 className="mt-3 text-3xl font-bold">{course.title}</h1>

      {streak.currentStreak > 0 && (
        <p
          className="mt-2 inline-flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-800 dark:bg-orange-900/30 dark:text-orange-200"
          title={`Kỷ lục dài nhất: ${streak.longestStreak} ngày`}
        >
          🔥 {streak.currentStreak} ngày liên tiếp
          {streak.isActiveToday && <span className="text-xs opacity-70"> · hôm nay ✓</span>}
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {/* Course completion progress */}
        <div className="flex items-center gap-3 rounded-lg bg-slate-100 px-4 py-3 dark:bg-slate-900">
          <div className="flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Tiến độ học
            </p>
            <div className="mt-1 h-2 rounded-full bg-slate-300 dark:bg-slate-700">
              <div
                className="h-2 rounded-full bg-emerald-500 transition-all"
                style={{ width: `${progress.courseCompletionPct}%` }}
              />
            </div>
          </div>
          <span className="text-sm font-medium tabular-nums">
            {progress.courseCompletionPct}%
          </span>
        </div>

        {/* XP / Level */}
        <div className="flex items-center gap-3 rounded-lg bg-amber-50 px-4 py-3 dark:bg-amber-900/20">
          <div className="flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-800 dark:text-amber-300">
              Level {xp.level} · {xp.levelName}
            </p>
            <div className="mt-1 h-2 rounded-full bg-amber-200 dark:bg-amber-900/50">
              <div
                className="h-2 rounded-full bg-amber-500 transition-all"
                style={{ width: `${xp.levelProgressPct}%` }}
              />
            </div>
          </div>
          <span className="text-sm font-medium tabular-nums">
            {xp.xp} XP
            {!xp.isMaxLevel && (
              <span className="block text-xs text-amber-700 dark:text-amber-400">
                +{xp.xpToNext} → L{xp.level + 1}
              </span>
            )}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {progress.courseCompletionPct >= 100 && (
          <Link
            href={`/learn/${params.slug}/certificate`}
            className="inline-block rounded border-2 border-amber-400 bg-amber-50 px-4 py-2 font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200"
          >
            🏆 Xem chứng nhận
          </Link>
        )}
        {enrollment.lastLessonId && (
          <Link
            href={`/learn/${params.slug}/lessons/${enrollment.lastLessonId}`}
            className="inline-block rounded bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700"
          >
            Tiếp tục bài học gần nhất →
          </Link>
        )}
        {adaptiveNext && (
          <Link
            href={`/learn/${params.slug}/lessons/${adaptiveNext.lessonId}`}
            className="inline-block rounded border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-900 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100 dark:hover:bg-violet-950/60"
            title={`Skill yếu nhất hiện tại: ${adaptiveNext.weakestSkillName} (${Math.round(
              adaptiveNext.masteryProbability * 100,
            )}%)`}
          >
            🧭 Đề xuất tiếp theo: {adaptiveNext.lessonTitle}
          </Link>
        )}
      </div>

      {/* Leaderboard — Phase 1 C5. Top 20 weekly XP, percentile for others. */}
      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Bảng xếp hạng tuần này</h2>
          <span className="text-xs text-slate-500">
            {leaderboard.totalParticipants} người tham gia
          </span>
        </div>
        {leaderboard.selfOptedOut && (
          <p className="mt-2 text-xs text-slate-500">
            Bạn đã tắt bảng xếp hạng. Bật lại trong{" "}
            <a href="/me/settings" className="underline">cài đặt</a>.
          </p>
        )}
        {leaderboard.entries.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            Chưa có ai có XP tuần này. Trở thành người đầu tiên!
          </p>
        ) : (
          <ol className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {leaderboard.entries.map((e) => (
              <li
                key={e.userId}
                className={`flex items-center gap-3 px-3 py-2 text-sm ${
                  e.isYou ? "bg-emerald-50 font-medium dark:bg-emerald-900/20" : ""
                }`}
              >
                <span className="w-6 text-right tabular-nums text-slate-500">
                  {e.rank === 1 ? "🥇" : e.rank === 2 ? "🥈" : e.rank === 3 ? "🥉" : `#${e.rank}`}
                </span>
                <span className="flex-1 truncate">
                  {e.displayName}
                  {e.isYou && <span className="ml-1 text-xs text-emerald-600">(bạn)</span>}
                </span>
                <span className="text-xs text-slate-500">L{e.level}</span>
                <span className="w-16 text-right tabular-nums">{e.weeklyXp} XP</span>
              </li>
            ))}
          </ol>
        )}
        {leaderboard.selfRank && (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-900">
            Bạn đang ở Top {leaderboard.selfRank.percentile}% ({leaderboard.selfRank.weeklyXp} XP tuần này)
          </p>
        )}
      </section>

      {/* C2 — Daily quests. */}
      {dailyQuests.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">🎯 Nhiệm vụ hôm nay</h2>
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {dailyQuests.map((q) => {
              const pct = Math.min(100, Math.round((q.count / q.target) * 100));
              return (
                <li
                  key={q.id}
                  title={q.description}
                  className={`rounded-lg border p-3 text-sm ${
                    q.completed
                      ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20"
                      : "border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <div className="flex items-baseline justify-between">
                    <p className="font-medium">
                      {q.emoji} {q.name}
                    </p>
                    <span className="text-xs text-amber-700 dark:text-amber-300">
                      +{q.rewardXp} XP
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        q.completed
                          ? "bg-emerald-500"
                          : "bg-slate-500 dark:bg-slate-400"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {q.completed
                      ? "✓ Đã hoàn thành"
                      : `${q.count} / ${q.target}`}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* D2 — Misconception champions: top learners by # resolved this week. */}
      {champions.entries.length > 0 && (
        <section className="mt-8">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">
              🌟 Champions khắc phục lỗi tư duy
            </h2>
            <span className="text-xs text-slate-500">
              {champions.lookbackDays} ngày qua
            </span>
          </div>
          <ol className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {champions.entries.map((e) => (
              <li
                key={e.userId}
                className={`flex items-center gap-3 px-3 py-2 text-sm ${
                  e.isYou ? "bg-emerald-50 font-medium dark:bg-emerald-900/20" : ""
                }`}
              >
                <span className="w-6 text-right tabular-nums text-slate-500">
                  {e.rank === 1 ? "🥇" : e.rank === 2 ? "🥈" : e.rank === 3 ? "🥉" : `#${e.rank}`}
                </span>
                <span className="flex-1 truncate">
                  {e.displayName}
                  {e.isYou && (
                    <span className="ml-1 text-xs text-emerald-600">(bạn)</span>
                  )}
                </span>
                <span className="w-24 text-right tabular-nums text-emerald-700 dark:text-emerald-300">
                  {e.resolvedCount} đã khắc phục
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Milestone badges — Phase 1 C3. Earned shown in color, locked dim. */}
      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Huy hiệu</h2>
          <span className="text-xs text-slate-500">
            {earnedCodes.size} / {catalog.length}
          </span>
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {catalog.map((b) => {
            const isEarned = earnedCodes.has(b.code);
            return (
              <li
                key={b.code}
                title={b.description}
                className={`rounded-lg border p-3 text-center transition ${
                  isEarned
                    ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20"
                    : "border-slate-200 bg-slate-50 opacity-50 grayscale dark:border-slate-800 dark:bg-slate-900"
                }`}
              >
                <div className="text-2xl">{b.emoji ?? "🏅"}</div>
                <div className="mt-1 text-xs font-medium">{b.name}</div>
              </li>
            );
          })}
        </ul>
      </section>

      <ol className="mt-8 space-y-4">
        {course.modules.map((m, mi) => (
          <li key={m.id} className="rounded border border-slate-200 p-4 dark:border-slate-800">
            <h3 className="font-medium">
              Module {mi + 1}: {m.title}
            </h3>
            <ol className="mt-2 space-y-1 text-sm">
              {m.lessons.map((l, li) => (
                <li key={l.id} className="flex items-center gap-2">
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                      completedSet.has(l.id)
                        ? "bg-emerald-500 text-white"
                        : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {completedSet.has(l.id) ? "✓" : li + 1}
                  </span>
                  <Link
                    href={`/learn/${params.slug}/lessons/${l.id}`}
                    className="hover:underline"
                  >
                    {l.title}
                  </Link>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>

      {progress.courseCompletionPct === 100 && (
        <div className="mt-8 rounded-lg bg-emerald-50 p-4 dark:bg-emerald-900/20">
          <p className="font-medium text-emerald-900 dark:text-emerald-200">
            🎉 Bạn đã hoàn thành khóa học này!
          </p>
        </div>
      )}
    </main>
  );
}
