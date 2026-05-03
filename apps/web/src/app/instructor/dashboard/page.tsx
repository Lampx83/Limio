import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { isAdmin } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  draft: "chip-accent",
  published: "chip-success",
  archived: "chip",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Nháp",
  published: "Đã publish",
  archived: "Lưu trữ",
};

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
        <div className="rounded-2xl border border-accent-200 bg-accent-50 p-5">
          <p className="text-sm font-semibold text-accent-700">
            ⚠️ Bạn chưa phải instructor của khóa nào.
          </p>
          <Link href="/instructor/courses/new" className="btn-primary mt-4 inline-flex">
            + Tạo khóa đầu tiên
          </Link>
        </div>
      </main>
    );
  }

  const courseIds = ownedCourses.map((c) => c.id);

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
  const totalStudents = ownedCourses.reduce((s, c) => s + c._count.enrollments, 0);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      {/* Greeting */}
      <header>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
          Giảng viên
        </span>
        <h1 className="mt-3 h-display text-3xl font-bold sm:text-4xl">
          Xin chào,{" "}
          <span className="text-gradient">
            {session.user.name ?? session.user.email}
          </span>{" "}
          👋
        </h1>
        <p className="mt-2 text-muted">
          Tổng quan {ownedCourses.length} khóa của bạn.
        </p>
      </header>

      {/* Quick actions */}
      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/instructor/courses/new" className="btn-primary btn-sm">
          + Tạo khóa học
        </Link>
        <Link href="/instructor/courses" className="btn-secondary btn-sm">
          📚 Tất cả khóa
        </Link>
        <Link
          href="/instructor/feedback-generator"
          className="btn-sm inline-flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-soft px-3 py-1.5 font-medium text-brand-700 transition-colors hover:bg-brand-100"
        >
          🪄 AI feedback gen
        </Link>
        <Link
          href="/instructor/feedback-templates"
          className="btn-secondary btn-sm"
        >
          📊 Feedback quality
        </Link>
        <Link
          href="/instructor/tournaments/new"
          className="btn-secondary btn-sm"
        >
          🏆 Tournament
        </Link>
      </div>

      {/* KPI cards */}
      <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Kpi label="Tổng học viên" value={totalStudents} icon="👥" tone="brand" />
        <Kpi
          label="Bài essay chờ chấm"
          value={pendingEssays}
          icon="📝"
          tone={pendingEssays > 0 ? "accent" : "success"}
        />
        <Kpi
          label="Assignment chờ chấm"
          value={pendingSubmissions}
          icon="📋"
          tone={pendingSubmissions > 0 ? "accent" : "success"}
        />
        <Kpi
          label="AI cost (7 ngày)"
          value={`$${aiCostWeek.toFixed(4)}`}
          sub={`${aiTokensWeek.toLocaleString()} tokens`}
          icon="💸"
          tone="brand"
        />
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        {/* Owned courses */}
        <section className="card">
          <header className="flex items-baseline justify-between border-b border-token pb-3">
            <h2 className="text-base font-semibold">📚 Khóa của tôi</h2>
            <span className="text-xs text-faint">{ownedCourses.length}</span>
          </header>
          <ul className="mt-4 space-y-3">
            {ownedCourses.map((c) => (
              <li
                key={c.id}
                className="rounded-xl border border-token p-3 transition-colors hover:border-brand-200"
              >
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/instructor/courses/${c.id}`}
                    className="font-semibold transition-colors hover:text-brand-600"
                  >
                    {c.title}
                  </Link>
                  <span className={STATUS_TONE[c.status] ?? "chip"}>
                    {STATUS_LABEL[c.status] ?? c.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-faint">
                  {c._count.enrollments} học viên · {c._count.modules} modules
                </p>
                <div className="mt-3 flex flex-wrap gap-1">
                  <a
                    href={`/api/exports/instructor/courses/${c.id}/gradebook`}
                    className="btn-ghost btn-sm"
                  >
                    📥 Gradebook
                  </a>
                  <a
                    href={`/api/exports/instructor/courses/${c.id}/submissions`}
                    className="btn-ghost btn-sm"
                  >
                    📥 Submissions
                  </a>
                  <Link
                    href={`/instructor/courses/${c.id}/struggling-students`}
                    className="btn-ghost btn-sm"
                  >
                    👥 HV cần hỗ trợ
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Recent unresolved forum threads */}
        <section className="card">
          <header className="flex items-baseline justify-between border-b border-token pb-3">
            <h2 className="text-base font-semibold">💬 Forum chưa giải đáp</h2>
            <span className="text-xs text-faint">{recentForumThreads.length}</span>
          </header>
          {recentForumThreads.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              Tất cả thread đã có người trả lời.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {recentForumThreads.map((t) => (
                <li
                  key={t.id}
                  className="rounded-lg border border-token p-3"
                >
                  <Link
                    href={`/learn/${t.lesson.module.course.slug}/threads/${t.id}`}
                    className="font-medium text-sm hover:text-brand-600"
                  >
                    {t.title}
                  </Link>
                  <p className="mt-1 text-xs text-faint">
                    <span className="font-medium">{t.author.displayName}</span> ·
                    bài &ldquo;{t.lesson.title}&rdquo; ·{" "}
                    {new Date(t.createdAt).toLocaleDateString("vi-VN")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function Kpi({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: string;
  tone: "brand" | "success" | "accent" | "danger";
}) {
  const toneClass = {
    brand: "text-brand-600",
    success: "text-success-600",
    accent: "text-accent-600",
    danger: "text-danger-600",
  }[tone];
  return (
    <div className="card">
      <div className="flex items-baseline justify-between">
        <span className="text-xl">{icon}</span>
        <span className={`h-display text-2xl font-bold tabular-nums ${toneClass}`}>
          {value}
        </span>
      </div>
      <div className="mt-1 text-xs text-muted sm:text-sm">{label}</div>
      {sub && <div className="mt-0.5 text-xs text-faint">{sub}</div>}
    </div>
  );
}
