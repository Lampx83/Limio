import BadgeIcon from "@/components/ui/BadgeIcon";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { prisma } from "@feedbackme/db";
import { canEditCourse, getCourseProgress, isUserEnrolled, listMockExamsForLearner } from "@feedbackme/core-lms";
import { LANGUAGE_SKILL_LABEL, isLanguageSkill } from "@feedbackme/shared-types";
import {
  getClearedChampionsLeaderboard,
  getCourseXpProgress,
  getDailyQuestsForUser,
  getLeaderboard,
  getStreak,
  listBadgeCatalog,
  listUserBadges,
} from "@feedbackme/core-gamification";
import { getFlashcardStats, getLearningPath, recordPathShown } from "@feedbackme/core-feedback";
import { reviewableToday } from "@/lib/flashcardSession";
import { auth } from "@/lib/auth";
import { StickyMobileCTA } from "@/components/ui";
import CourseLeaderboardCard from "@/components/CourseLeaderboardCard";
import PaymentProcessingNotice from "@/components/PaymentProcessingNotice";
import LearningPathList from "@/components/LearningPathList";

export const dynamic = "force-dynamic";

export default async function LearnCoursePage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams?: { paid?: string; preview?: string };
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

  // Giảng viên xem thử trang khoá như học viên thấy (?preview=1): chỉ người dạy
  // khoá, không cần ghi danh, và không đụng dữ liệu học tập của ai (XP, chuỗi
  // ngày, bảng xếp hạng đều gắn với một học viên cụ thể nên bỏ hẳn).
  if (searchParams?.preview === "1" && (await canEditCourse(session.user.id, course.id))) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-6">
        <Link
          href={`/instructor/courses/${course.id}?tab=content`}
          className="link inline-flex items-center gap-1 text-sm"
        >
          ← Quay lại soạn khoá
        </Link>
        <header className="relative mt-4 overflow-hidden rounded-2xl bg-brand-gradient p-6 text-white shadow-card-hover sm:p-8">
          <div className="absolute inset-0 bg-hero-grid opacity-20" style={{ backgroundSize: "20px 20px" }} aria-hidden />
          <div className="relative">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium backdrop-blur">
              {course.level} · {course.language}
            </span>
            <h1 className="mt-3 h-display text-3xl font-bold sm:text-4xl">{course.title}</h1>
          </div>
        </header>
        <section className="mt-8">
          <h2 className="text-xl font-semibold">Lộ trình học</h2>
          <ModuleList
            modules={course.modules}
            slug={params.slug}
            completedSet={new Set()}
            lessonQuery="?preview=1"
          />
        </section>
      </main>
    );
  }

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
    learningPath,
    catalog,
    earned,
    flashcardStats,
    mockExams,
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
    getLearningPath(session.user.id, course.id),
    listBadgeCatalog(),
    listUserBadges(session.user.id),
    getFlashcardStats(session.user.id, course.id),
    // Đề thi thử đã xuất bản của khoá. Lỗi ở đây không được làm hỏng cả trang khoá.
    listMockExamsForLearner(session.user.id, course.id).catch(() => []),
  ]);
  const earnedCodes = new Set(earned.map((u) => u.badge.code));
  const completedSet = new Set(
    progress.modules.flatMap((m) => m.lessons.filter((l) => l.completed).map((l) => l.id)),
  );

  const isComplete = progress.courseCompletionPct >= 100;

  // Bài chưa học đầu tiên theo thứ tự khoá — không cá nhân hoá, nên lớp đối
  // chứng và khoá tắt cá nhân hoá cũng có nút vào học (B4 AC-2.8).
  const firstOpenLessonId = progress.modules
    .flatMap((m) => m.lessons)
    .find((l) => !l.completed && !l.locked)?.id;
  const continueLessonId = enrollment.lastLessonId || firstOpenLessonId;
  const continueLabel = enrollment.lastLessonId ? "Tiếp tục" : firstOpenLessonId ? "Bắt đầu" : null;

  // B4 AC-2.13 — ghi mẫu số uptake. Đo lường không được làm hỏng trang.
  if (learningPath.steps.length > 0) {
    await recordPathShown(session.user.id, course.id, learningPath.steps, "course_home").catch(
      () => {},
    );
  }

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
                title={`Kỷ lục dài nhất: ${streak.longestStreak} ngày. ${
                  streak.freezeAvailable
                    ? "Đóng băng streak sẵn sàng: bỏ lỡ 1 ngày không mất chuỗi."
                    : "Đóng băng streak đang nghỉ (dùng lại sau 7 ngày)."
                }`}
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
          {/* LANG G3 — lối vào Hồ sơ 4 kỹ năng. Dùng learningPath.enabled để lớp đối chứng
              (B10) và khoá tắt cá nhân hoá không bao giờ thấy lối vào này. */}
          {course.languageMode && learningPath.enabled && (
            <section>
              <Link
                href={`/learn/${params.slug}/skills`}
                className="flex items-center justify-between gap-3 rounded-xl border border-token bg-[rgb(var(--surface))] p-4 transition-colors hover:bg-brand-soft"
              >
                <span>
                  <span className="text-body font-medium">Hồ sơ 4 kỹ năng</span>
                  <span className="text-meta block">Xem bạn đang mạnh và cần luyện kỹ năng nào: nghe, nói, đọc, viết.</span>
                </span>
                <span aria-hidden>→</span>
              </Link>
            </section>
          )}

          {/* LANG G4 — ôn từ vựng bằng flashcard. Không phụ thuộc chế độ ngoại ngữ hay lớp đối
              chứng: đây là công cụ ghi nhớ, không phải feedback cá nhân hoá. */}
          {flashcardStats.total > 0 && (
            <section>
              <Link
                href={`/learn/${params.slug}/flashcards`}
                className="flex items-center justify-between gap-3 rounded-xl border border-token bg-[rgb(var(--surface))] p-4 transition-colors hover:bg-brand-soft"
              >
                <span>
                  <span className="text-body font-medium">Ôn từ vựng</span>
                  <span className="text-meta block">
                    {reviewableToday(flashcardStats) > 0
                      ? `${reviewableToday(flashcardStats)} thẻ có thể ôn hôm nay.`
                      : "Hôm nay bạn đã ôn xong."}
                  </span>
                </span>
                <span aria-hidden>→</span>
              </Link>
            </section>
          )}

          {/* LANG G5c — Luyện thi: đề thi thử đã xuất bản của khoá. Trước đây học viên không có
              đường nào vào đề thi từ trang khoá (chỉ qua link giảng viên gửi). */}
          {mockExams.length > 0 && (
            <section aria-labelledby="mock-exams-title">
              <h2 id="mock-exams-title" className="text-h3">Luyện thi</h2>
              <p className="text-meta mt-1">
                Thi thử theo cấu trúc đề thật (mỗi phần có giờ riêng, làm lần lượt, không quay lại) hoặc luyện đề theo kỹ năng (không bấm giờ, xem đáp án ngay).
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {mockExams.map((e) => {
                  const a = e.attempt;
                  const inProgress = a?.status === "in_progress";
                  const href = `/learn/${params.slug}/exams/${e.examId}`;
                  return (
                    <div key={e.examId} className="flex flex-col gap-3 rounded-xl border border-token bg-[rgb(var(--surface))] p-4">
                      <div>
                        <p className="text-body font-semibold">{e.title}</p>
                        <p className="text-meta">
                          {e.sections.length} phần · {e.totalMinutes} phút
                        </p>
                      </div>
                      <ul className="flex flex-wrap gap-1.5">
                        {e.sections.map((sec, i) => (
                          <li key={i} className="rounded-full bg-[rgb(var(--surface-muted))] px-2.5 py-0.5 text-xs text-muted">
                            {sec.languageSkill &&
                            isLanguageSkill(sec.languageSkill) &&
                            LANGUAGE_SKILL_LABEL[sec.languageSkill] !== sec.title
                              ? `${LANGUAGE_SKILL_LABEL[sec.languageSkill]} · `
                              : ""}
                            {sec.title} · {sec.durationMin}′
                          </li>
                        ))}
                      </ul>
                      <div className="mt-auto flex items-center justify-between gap-2">
                        <span className="text-meta">
                          {!a
                            ? "Chưa làm"
                            : inProgress
                              ? `Đang làm dở · lượt ${e.attemptCount}`
                              : `Đã thi ${e.attemptCount} lần${a.scorePct != null ? ` · gần nhất ${Math.round(a.scorePct)}%` : ""}`}
                        </span>
                        <span className="flex items-center gap-2">
                          {a && !inProgress && (
                            <Link
                              href={`${href}/${a.attemptId}/result`}
                              className="inline-flex h-9 items-center rounded-full border border-token px-4 text-sm hover:bg-brand-soft"
                            >
                              Xem kết quả
                            </Link>
                          )}
                          {e.allowPractice && (
                            <Link
                              href={`${href}/practice`}
                              className="inline-flex h-9 items-center rounded-full border border-brand-300 bg-brand-soft px-4 text-sm font-medium text-brand-800 hover:bg-brand-100"
                            >
                              Luyện đề
                            </Link>
                          )}
                          {(e.allowMock || inProgress) && (
                            <Link
                              href={a && !inProgress ? `${href}?retake=1` : href}
                              className="inline-flex h-9 items-center rounded-full bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
                            >
                              {!a ? "Thi thử" : inProgress ? "Tiếp tục" : "Thi lại"}
                            </Link>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* B4 — lộ trình cá nhân hoá */}
          {learningPath.steps.length > 0 && (
            <section>
              <h2 className="text-h3">Lộ trình của bạn</h2>
              <p className="text-meta mt-1">
                Gợi ý dựa trên kết quả làm bài của bạn. Bạn vẫn có thể học bất kỳ bài nào.
              </p>
              <div className="mt-3">
                <LearningPathList
                  steps={learningPath.steps}
                  courseSlug={params.slug}
                  surface="course_home"
                />
              </div>
            </section>
          )}

          {/* Modules */}
          <section>
            <div className="flex items-baseline justify-between">
              <h2 className="text-xl font-semibold">Nội dung khoá học</h2>
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
            <ModuleList
              modules={course.modules}
              slug={params.slug}
              completedSet={completedSet}
            />
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
                      <BadgeIcon code={b.code} className="mx-auto h-14 w-14" />
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

type ModuleForList = {
  id: string;
  title: string;
  isHidden: boolean;
  isLocked: boolean;
  lessons: Array<{ id: string; title: string; isHidden: boolean; isLocked: boolean }>;
};

/**
 * Danh sách module + bài của khoá — dùng chung cho trang học viên thật và bản
 * xem trước của giảng viên (`preview=1`, `lessonQuery` để các bài mở tiếp ở chế
 * độ xem trước).
 */
function ModuleList({
  modules,
  slug,
  completedSet,
  lessonQuery = "",
}: {
  modules: ModuleForList[];
  slug: string;
  completedSet: Set<string>;
  lessonQuery?: string;
}) {
  return (
    <ol className="mt-4 space-y-4">
              {modules
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
                              href={`/learn/${slug}/lessons/${l.id}${lessonQuery}`}
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
