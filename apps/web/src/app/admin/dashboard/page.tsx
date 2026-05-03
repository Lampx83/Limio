import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin, listIntegrationStatuses } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/admin/dashboard");
  if (!(await isAdmin(session.user.id))) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="rounded border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          Chỉ admin mới truy cập được.
        </p>
      </main>
    );
  }

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const monthKey = new Date().toISOString().slice(0, 7);

  const [
    totalUsers,
    usersThisWeek,
    coursesByStatus,
    enrollmentsThisWeek,
    eventsToday,
    auditLogRecent,
    integrations,
    aiLogsMonth,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.course.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.enrollment.count({ where: { enrolledAt: { gte: weekAgo } } }),
    prisma.learningEvent.count({ where: { occurredAt: { gte: todayStart } } }),
    prisma.auditLog.findMany({
      orderBy: { occurredAt: "desc" },
      take: 8,
      include: {
        actor: { select: { displayName: true, email: true } },
        target: { select: { displayName: true, email: true } },
      },
    }),
    listIntegrationStatuses(),
    prisma.aiUsageLog.findMany({
      where: { dayKey: { startsWith: monthKey } },
    }),
  ]);

  const aiCostMonth = aiLogsMonth.reduce((s, l) => s + l.costUsd, 0);
  const aiTokensMonth = aiLogsMonth.reduce(
    (s, l) => s + l.tokensInput + l.tokensOutput,
    0,
  );
  const aiTopUsers = Object.entries(
    aiLogsMonth.reduce<Record<string, number>>((acc, l) => {
      acc[l.userId] = (acc[l.userId] ?? 0) + l.costUsd;
      return acc;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const topUserDetails =
    aiTopUsers.length === 0
      ? []
      : await prisma.user.findMany({
          where: { id: { in: aiTopUsers.map((x) => x[0]) } },
          select: { id: true, displayName: true, email: true },
        });
  const topUserMap = new Map(topUserDetails.map((u) => [u.id, u]));

  const courseCountMap = Object.fromEntries(
    coursesByStatus.map((c) => [c.status, c._count._all]),
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-3xl font-bold">Bảng điều khiển — Admin</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Tổng quan hệ thống, audit log, integration, AI cost.
      </p>

      <div className="mt-6 flex flex-wrap gap-2 text-sm">
        <Link
          href="/admin/integrations"
          className="rounded border border-slate-300 px-3 py-1.5 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
        >
          Integrations
        </Link>
        <Link
          href="/admin/lti-tools"
          className="rounded border border-slate-300 px-3 py-1.5 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
        >
          LTI tools
        </Link>
        <a
          href="/api/exports/admin/users"
          className="rounded border border-slate-300 px-3 py-1.5 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
        >
          📥 Users.csv
        </a>
        <a
          href="/api/exports/admin/audit"
          className="rounded border border-slate-300 px-3 py-1.5 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
        >
          📥 Audit log.csv
        </a>
        <a
          href="/api/exports/admin/ai-usage"
          className="rounded border border-slate-300 px-3 py-1.5 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
        >
          📥 AI usage.csv
        </a>
      </div>

      {/* KPIs */}
      <section className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi label="Tổng users" value={totalUsers} sub={`+${usersThisWeek} tuần này`} />
        <Kpi
          label="Khóa published"
          value={courseCountMap.published ?? 0}
          sub={`draft: ${courseCountMap.draft ?? 0}`}
        />
        <Kpi label="Enrollment 7d" value={enrollmentsThisWeek} />
        <Kpi label="Events hôm nay" value={eventsToday} />
        <Kpi
          label="AI cost tháng"
          value={`$${aiCostMonth.toFixed(4)}`}
          sub={`${aiTokensMonth.toLocaleString()} tokens`}
        />
        <Kpi
          label="OpenAI"
          value={
            integrations.find((i) => i.key === "openai")?.hasValue ? "✓" : "✗"
          }
          tone={
            integrations.find((i) => i.key === "openai")?.hasValue ? "ok" : "warn"
          }
        />
        <Kpi
          label="Stripe"
          value={
            integrations.find((i) => i.key === "stripe.secret")?.hasValue
              ? "✓"
              : "—"
          }
        />
        <Kpi
          label="VNPay"
          value={
            integrations.find((i) => i.key === "vnpay.secret")?.hasValue
              ? "✓"
              : "—"
          }
        />
      </section>

      <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Recent audit log */}
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <h2 className="text-sm font-semibold uppercase text-slate-500">
            🔒 Audit log gần đây
          </h2>
          {auditLogRecent.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Chưa có audit log nào.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {auditLogRecent.map((a) => (
                <li
                  key={a.id}
                  className="rounded border border-slate-100 p-2 dark:border-slate-900"
                >
                  <p className="font-mono text-xs">{a.action}</p>
                  <p className="text-xs text-slate-500">
                    {a.actor?.displayName ?? "system"} →{" "}
                    {a.target?.displayName ?? "—"} ·{" "}
                    {new Date(a.occurredAt).toLocaleString("vi-VN")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* AI top users this month */}
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <h2 className="text-sm font-semibold uppercase text-slate-500">
            💸 Top AI cost tháng này ({monthKey})
          </h2>
          {aiTopUsers.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              Chưa có usage AI tháng này.
            </p>
          ) : (
            <ul className="mt-3 space-y-1 text-sm">
              {aiTopUsers.map(([uid, cost]) => {
                const u = topUserMap.get(uid);
                return (
                  <li key={uid} className="flex items-center gap-2">
                    <span className="flex-1">
                      {u?.displayName ?? uid.slice(0, 8)}
                      <span className="ml-1 text-xs text-slate-500">
                        {u?.email ?? ""}
                      </span>
                    </span>
                    <span className="font-mono text-xs tabular-nums">
                      ${cost.toFixed(4)}
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
