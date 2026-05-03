import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { getCourseProgress } from "@feedbackme/core-lms";
import { getLearnerSkillStates } from "@feedbackme/core-feedback";
import { LearningEventType } from "@feedbackme/shared-types";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LearnerDashboard() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/me/dashboard");
  const userId = session.user.id;

  const enrollments = await prisma.enrollment.findMany({
    where: { userId },
    include: { course: { select: { id: true, slug: true, title: true } } },
    orderBy: { enrolledAt: "desc" },
  });

  const progressByCourse = await Promise.all(
    enrollments.map((e) => getCourseProgress(userId, e.course.id)),
  );
  const xpByCourse = await prisma.userCourseProgress.findMany({ where: { userId } });
  const xpMap = new Map(xpByCourse.map((x) => [x.courseId, x]));

  const allSkillStates = await getLearnerSkillStates(userId, undefined);
  const weakSkills = allSkillStates.filter((s) => s.isWeak).slice(0, 5);
  const masteredSkills = allSkillStates.filter((s) => s.masteryProbability >= 0.9).length;

  const recentBadges = await prisma.userBadge.findMany({
    where: { userId },
    orderBy: { earnedAt: "desc" },
    take: 5,
    include: { badge: { select: { code: true, name: true, emoji: true } } },
  });

  const courseIds = enrollments.map((e) => e.courseId);
  const upcomingAssignments = await prisma.assignment.findMany({
    where: {
      lesson: { module: { courseId: { in: courseIds } } },
      OR: [{ dueAt: null }, { dueAt: { gte: new Date() } }],
    },
    include: {
      submissions: { where: { userId } },
      lesson: {
        select: {
          title: true,
          module: { select: { course: { select: { slug: true, title: true } } } },
        },
      },
    },
    take: 10,
    orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }],
  });

  const recentResolved = await prisma.learningEvent.findMany({
    where: { userId, eventType: LearningEventType.MisconceptionResolved },
    orderBy: { occurredAt: "desc" },
    take: 5,
  });

  // "Continue learning" — most-recent in-progress enrollment with lastLessonId.
  const continueTarget = enrollments
    .map((e, i) => ({ e, p: progressByCourse[i]! }))
    .filter((x) => x.e.lastLessonId && x.p.courseCompletionPct < 100)[0];

  const totalLessons = progressByCourse.reduce((s, p) => s + p.totalLessons, 0);
  const completedLessons = progressByCourse.reduce((s, p) => s + p.completedLessons, 0);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
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

      {/* Continue learning hero CTA */}
      {continueTarget && (
        <Link
          href={`/learn/${continueTarget.e.course.slug}/lessons/${continueTarget.e.lastLessonId}`}
          className="group relative mt-6 block overflow-hidden rounded-2xl bg-brand-gradient p-6 text-white shadow-card-hover transition-transform hover:-translate-y-0.5 sm:p-8"
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
              <p className="mt-3 h-display text-2xl font-bold sm:text-3xl">
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
            <span className="text-3xl transition-transform group-hover:translate-x-2">
              →
            </span>
          </div>
        </Link>
      )}

      {/* KPI cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Stat
          label="Khóa đã enroll"
          value={enrollments.length}
          tone="brand"
          icon=""
          href="/me/enrollments"
        />
        <Stat
          label="Bài đã hoàn thành"
          value={`${completedLessons}/${totalLessons}`}
          tone="success"
          icon="✓"
        />
        <Stat
          label="Skill master"
          value={masteredSkills}
          tone="accent"
          icon=""
          href="/me/skills"
        />
        <Stat
          label="Huy hiệu"
          value={recentBadges.length}
          tone="brand"
          icon=""
          href="/me/badges"
        />
      </div>



      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        {/* Enrolled courses */}
        <section className="card">
          <header className="flex items-baseline justify-between border-b border-token pb-3">
            <h2 className="text-base font-semibold">Khóa đã đăng ký</h2>
            <span className="text-xs text-faint">{enrollments.length}</span>
          </header>
          {enrollments.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              Chưa có khóa nào.{" "}
              <Link href="/catalog" className="link">
                Vào catalog
              </Link>
              .
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {enrollments.slice(0, 5).map((e, i) => {
                const p = progressByCourse[i]!;
                const xp = xpMap.get(e.course.id);
                const done = p.courseCompletionPct >= 100;
                return (
                  <li key={e.id}>
                    <Link
                      href={`/learn/${e.course.slug}`}
                      className="group block rounded-xl border border-token p-3 transition-colors hover:border-brand-200"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="font-medium transition-colors group-hover:text-brand-600">
                          {e.course.title}
                        </p>
                        {done && <span className="chip-success">✓</span>}
                      </div>
                      <div className="mt-1.5 flex items-center gap-2 text-xs text-faint">
                        <span>{p.courseCompletionPct}% hoàn thành</span>
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
                          style={{ width: `${p.courseCompletionPct}%` }}
                        />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Recent badges */}
        <section className="card">
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
                  <div className="text-2xl">{b.badge.emoji ?? ""}</div>
                  <div className="mt-1 truncate text-xs font-medium text-accent-700">
                    {b.badge.name}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Weak skills */}
        <section className="card">
          <header className="flex items-baseline justify-between border-b border-token pb-3">
            <h2 className="text-base font-semibold">Skill cần ôn</h2>
            <Link href="/me/skills" className="link text-sm">
              Skill profile →
            </Link>
          </header>
          {weakSkills.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              Chưa có skill yếu rõ rệt — tiếp tục học để hệ thống đánh giá!
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
                  <span className="text-xs font-semibold tabular-nums text-danger-600">
                    {Math.round(s.masteryProbability * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Upcoming assignments */}
        <section className="card">
          <header className="flex items-baseline justify-between border-b border-token pb-3">
            <h2 className="text-base font-semibold">Bài tập</h2>
            <span className="text-xs text-faint">{upcomingAssignments.length}</span>
          </header>
          {upcomingAssignments.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Không có bài tập nào.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {upcomingAssignments.slice(0, 5).map((a) => {
                const sub = a.submissions[0];
                const status = !sub
                  ? { label: "Chưa nộp", chip: "chip-accent" }
                  : sub.status === "graded"
                    ? { label: `✓ ${sub.score}/${a.maxScore}`, chip: "chip-success" }
                    : { label: "Đã nộp", chip: "chip-brand" };
                return (
                  <li
                    key={a.id}
                    className="rounded-lg border border-token p-3 text-sm"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-medium">{a.title}</p>
                      <span className={status.chip}>{status.label}</span>
                    </div>
                    <p className="mt-1 text-xs text-faint">
                      {a.lesson.module.course.title}
                      {a.dueAt && (
                        <>
                          {" · hạn "}
                          {new Date(a.dueAt).toLocaleDateString("vi-VN")}
                        </>
                      )}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

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
                      {new Date(e.occurredAt).toLocaleDateString("vi-VN")}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  tone,
  icon,
  href,
}: {
  label: string;
  value: string | number;
  tone: "brand" | "success" | "accent" | "danger";
  icon: string;
  href?: string;
}) {
  const toneClass = {
    brand: "text-brand-600",
    success: "text-success-600",
    accent: "text-accent-600",
    danger: "text-danger-600",
  }[tone];
  const inner = (
    <>
      <div className="flex items-baseline justify-between">
        <span className="text-xl">{icon}</span>
        <span className={`h-display text-2xl font-bold tabular-nums ${toneClass}`}>
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
