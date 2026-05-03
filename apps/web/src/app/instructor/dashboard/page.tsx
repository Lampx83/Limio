import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { isAdmin } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function InstructorDashboard() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/instructor/dashboard");
  const userId = session.user.id;

  const [admin, ownedCourses] = await Promise.all([
    isAdmin(userId),
    prisma.course.findMany({
      where: { instructors: { some: { userId } } },
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        _count: { select: { enrollments: true, modules: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  if (!admin && ownedCourses.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="rounded border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100">
          Bạn chưa phải instructor của khóa nào.{" "}
          <Link href="/instructor/courses/new" className="underline">
            Tạo khóa đầu tiên
          </Link>
          .
        </p>
      </main>
    );
  }

  const courseIds = ownedCourses.map((c) => c.id);

  // Pending essay grading + assignment grading counts.
  const [pendingEssays, pendingSubmissions, recentForumThreads, aiUsageWeek] =
    await Promise.all([
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
          assignment: { lesson: { module: { courseId: { in: courseIds } } } },
        },
      }),
      prisma.forumThread.findMany({
        where: {
          lesson: { module: { courseId: { in: courseIds } } },
          resolvedPostId: null,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          author: { select: { displayName: true } },
          lesson: {
            select: {
              title: true,
              module: { select: { course: { select: { slug: true } } } },
            },
          },
        },
      }),
      prisma.aiUsageLog.findMany({
        where: {
          userId,
          dayKey: {
            gte: new Date(Date.now() - 7 * 24 * 3600 * 1000)
              .toISOString()
              .slice(0, 10),
          },
        },
      }),
    ]);

  const aiCostWeek = aiUsageWeek.reduce((s, l) => s + l.costUsd, 0);
  const aiTokensWeek = aiUsageWeek.reduce(
    (s, l) => s + l.tokensInput + l.tokensOutput,
    0,
  );

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-3xl font-bold">Bảng điều khiển — Instructor</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Tổng quan {ownedCourses.length} khóa của bạn.
      </p>

      <div className="mt-6 flex flex-wrap gap-2 text-sm">
        <Link
          href="/instructor/courses"
          className="rounded border border-slate-300 px-3 py-1.5 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
        >
          Tất cả khóa của tôi
        </Link>
        <Link
          href="/instructor/feedback-generator"
          className="rounded border border-violet-300 px-3 py-1.5 text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950/40"
        >
          🪄 AI feedback gen
        </Link>
        <Link
          href="/instructor/feedback-templates"
          className="rounded border border-slate-300 px-3 py-1.5 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
        >
          Feedback quality
        </Link>
      </div>

      {/* KPIs */}
      <section className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi
          label="Tổng học viên"
          value={ownedCourses.reduce((s, c) => s + c._count.enrollments, 0)}
        />
        <Kpi
          label="Bài essay chờ chấm"
          value={pendingEssays}
          tone={pendingEssays > 0 ? "warn" : "ok"}
        />
        <Kpi
          label="Assignment chờ chấm"
          value={pendingSubmissions}
          tone={pendingSubmissions > 0 ? "warn" : "ok"}
        />
        <Kpi
          label="AI cost (7 ngày)"
          value={`$${aiCostWeek.toFixed(4)}`}
          sub={`${aiTokensWeek.toLocaleString()} tokens`}
        />
      </section>

      <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Owned courses with quick exports */}
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <h2 className="text-sm font-semibold uppercase text-slate-500">
            📚 Khóa của tôi ({ownedCourses.length})
          </h2>
          <ul className="mt-3 space-y-3 text-sm">
            {ownedCourses.map((c) => (
              <li
                key={c.id}
                className="rounded border border-slate-100 p-2 dark:border-slate-900"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <Link
                    href={`/instructor/courses/${c.id}`}
                    className="font-medium hover:underline"
                  >
                    {c.title}
                  </Link>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] ${
                      c.status === "published"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                    }`}
                  >
                    {c.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {c._count.enrollments} học viên · {c._count.modules} modules
                </p>
                <div className="mt-2 flex flex-wrap gap-1 text-xs">
                  <a
                    href={`/api/exports/instructor/courses/${c.id}/gradebook`}
                    className="rounded border border-slate-300 px-1.5 py-0.5 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
                  >
                    📥 Gradebook
                  </a>
                  <a
                    href={`/api/exports/instructor/courses/${c.id}/submissions`}
                    className="rounded border border-slate-300 px-1.5 py-0.5 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
                  >
                    📥 Submissions
                  </a>
                  <Link
                    href={`/instructor/courses/${c.id}/struggling-students`}
                    className="rounded border border-slate-300 px-1.5 py-0.5 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
                  >
                    HV cần hỗ trợ
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Recent unresolved forum threads */}
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <h2 className="text-sm font-semibold uppercase text-slate-500">
            💬 Forum chưa giải đáp ({recentForumThreads.length})
          </h2>
          {recentForumThreads.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Tất cả thread đã có người trả lời.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {recentForumThreads.map((t) => (
                <li key={t.id} className="rounded border border-slate-100 p-2 dark:border-slate-900">
                  <Link
                    href={`/learn/${t.lesson.module.course.slug}/threads/${t.id}`}
                    className="font-medium hover:underline"
                  >
                    {t.title}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {t.author.displayName} · lesson "{t.lesson.title}" ·{" "}
                    {new Date(t.createdAt).toLocaleDateString("vi-VN")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone = "ok",
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "ok" | "warn";
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        tone === "warn"
          ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20"
          : "border-slate-200 dark:border-slate-800"
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p>}
    </div>
  );
}
