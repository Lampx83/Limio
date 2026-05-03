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

  // Enrolled courses with course meta + progress + xp.
  const enrollments = await prisma.enrollment.findMany({
    where: { userId },
    include: {
      course: { select: { id: true, slug: true, title: true } },
    },
    orderBy: { enrolledAt: "desc" },
  });

  const progressByCourse = await Promise.all(
    enrollments.map((e) => getCourseProgress(userId, e.course.id)),
  );
  const xpByCourse = await prisma.userCourseProgress.findMany({
    where: { userId },
  });
  const xpMap = new Map(xpByCourse.map((x) => [x.courseId, x]));

  // Top weak skills (across all courses).
  const allSkillStates = await getLearnerSkillStates(userId, undefined);
  const weakSkills = allSkillStates
    .filter((s) => s.isWeak)
    .slice(0, 5);

  // Recent badges.
  const recentBadges = await prisma.userBadge.findMany({
    where: { userId },
    orderBy: { earnedAt: "desc" },
    take: 5,
    include: { badge: { select: { code: true, name: true, emoji: true } } },
  });

  // Pending assignments (assignments in enrolled courses with no submission OR
  // submission but not yet graded, due within 14 days).
  const courseIds = enrollments.map((e) => e.courseId);
  const upcomingAssignments = await prisma.assignment.findMany({
    where: {
      lesson: { module: { courseId: { in: courseIds } } },
      OR: [
        { dueAt: null },
        { dueAt: { gte: new Date() } },
      ],
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

  // Recent misconception resolutions (events).
  const recentResolved = await prisma.learningEvent.findMany({
    where: { userId, eventType: LearningEventType.MisconceptionResolved },
    orderBy: { occurredAt: "desc" },
    take: 5,
  });

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-3xl font-bold">Bảng điều khiển — Học viên</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Xin chào {session.user.name ?? session.user.email}. Tổng quan tiến độ
        học của bạn.
      </p>

      <div className="mt-6 flex flex-wrap gap-2 text-sm">
        <a
          href="/api/exports/learner/grades"
          className="rounded border border-slate-300 px-3 py-1.5 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
        >
          📥 Xuất điểm (.csv)
        </a>
        <a
          href="/api/exports/learner/activity"
          className="rounded border border-slate-300 px-3 py-1.5 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
        >
          📥 Xuất nhật ký hoạt động (.csv)
        </a>
      </div>

      <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Enrolled courses */}
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <h2 className="text-sm font-semibold uppercase text-slate-500">
            📚 Khóa đã đăng ký ({enrollments.length})
          </h2>
          {enrollments.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              Chưa có khóa nào.{" "}
              <Link href="/catalog" className="underline">
                Vào catalog
              </Link>
              .
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {enrollments.map((e, i) => {
                const p = progressByCourse[i]!;
                const xp = xpMap.get(e.course.id);
                return (
                  <li
                    key={e.id}
                    className="rounded border border-slate-100 p-2 dark:border-slate-900"
                  >
                    <Link
                      href={`/learn/${e.course.slug}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {e.course.title}
                    </Link>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <span>{p.courseCompletionPct}% hoàn thành</span>
                      {xp && (
                        <>
                          <span>·</span>
                          <span>L{xp.level} · {xp.xp} XP</span>
                        </>
                      )}
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-1.5 rounded-full bg-emerald-500"
                        style={{ width: `${p.courseCompletionPct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Recent badges */}
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <h2 className="text-sm font-semibold uppercase text-slate-500">
            🏆 Huy hiệu gần đây ({recentBadges.length})
          </h2>
          {recentBadges.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              Chưa có huy hiệu nào.
            </p>
          ) : (
            <ul className="mt-3 space-y-1 text-sm">
              {recentBadges.map((b) => (
                <li key={b.id} className="flex items-center gap-2">
                  <span className="text-lg">{b.badge.emoji ?? "🏅"}</span>
                  <span className="flex-1">{b.badge.name}</span>
                  <span className="text-xs text-slate-500">
                    {new Date(b.earnedAt).toLocaleDateString("vi-VN")}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/me/badges"
            className="mt-3 block text-xs text-slate-600 underline hover:text-slate-800 dark:text-slate-400"
          >
            Xem tất cả huy hiệu →
          </Link>
        </div>

        {/* Weak skills */}
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <h2 className="text-sm font-semibold uppercase text-slate-500">
            🎯 Skill cần rèn luyện ({weakSkills.length})
          </h2>
          {weakSkills.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              Chưa có skill yếu rõ rệt — tiếp tục học để hệ thống đánh giá!
            </p>
          ) : (
            <ul className="mt-3 space-y-1 text-sm">
              {weakSkills.map((s) => (
                <li key={s.skillId} className="flex items-center gap-2">
                  <span className="flex-1">{s.skillName}</span>
                  <span className="text-xs text-amber-700 dark:text-amber-300">
                    {Math.round(s.masteryProbability * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/me/skills"
            className="mt-3 block text-xs text-slate-600 underline hover:text-slate-800 dark:text-slate-400"
          >
            Skill profile chi tiết →
          </Link>
        </div>

        {/* Upcoming assignments */}
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <h2 className="text-sm font-semibold uppercase text-slate-500">
            📋 Assignment ({upcomingAssignments.length})
          </h2>
          {upcomingAssignments.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Không có bài tập nào.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {upcomingAssignments.slice(0, 5).map((a) => {
                const sub = a.submissions[0];
                const status = !sub
                  ? "Chưa nộp"
                  : sub.status === "graded"
                    ? `✓ ${sub.score}/${a.maxScore}`
                    : "⏳ Đã nộp";
                return (
                  <li key={a.id}>
                    <p className="font-medium">{a.title}</p>
                    <p className="text-xs text-slate-500">
                      {a.lesson.module.course.title} · {status}
                      {a.dueAt && (
                        <> · hạn {new Date(a.dueAt).toLocaleDateString("vi-VN")}</>
                      )}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Recent misconception resolutions */}
        <div className="rounded-lg border border-slate-200 p-4 md:col-span-2 dark:border-slate-800">
          <h2 className="text-sm font-semibold uppercase text-slate-500">
            🌟 Khắc phục lỗi tư duy gần đây ({recentResolved.length})
          </h2>
          {recentResolved.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              Chưa có. Khi học viên trả lời sai → đúng cho cùng lỗi tư duy, đây
              sẽ là ghi nhận.
            </p>
          ) : (
            <ul className="mt-3 space-y-1 text-sm">
              {recentResolved.map((e) => {
                const p = e.payload as {
                  misconceptionCode?: string;
                  misconceptionId?: string;
                };
                return (
                  <li key={String(e.id)} className="flex items-center gap-2">
                    <span className="text-emerald-600">✓</span>
                    <span className="flex-1 font-mono text-xs">
                      {p.misconceptionCode ?? "—"}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(e.occurredAt).toLocaleDateString("vi-VN")}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
