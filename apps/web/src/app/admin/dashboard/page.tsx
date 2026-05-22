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
        <div className="rounded-2xl border border-danger-100 bg-danger-50 p-5 text-sm text-danger-700">
          Chỉ admin mới truy cập được.
        </div>
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
    prisma.aiUsageLog.findMany({ where: { dayKey: { startsWith: monthKey } } }),
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

  const openaiOk = integrations.find((i) => i.key === "openai")?.hasValue ?? false;
  const stripeOk =
    integrations.find((i) => i.key === "stripe.secret")?.hasValue ?? false;
  const vnpayOk =
    integrations.find((i) => i.key === "vnpay.secret")?.hasValue ?? false;

  return (
    <main>
      {/* Greeting */}
      <header>
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700">
          Quản trị
        </span>
        <h1 className="mt-3 h-display text-3xl font-bold sm:text-4xl">
          Xin chào,{" "}
          <span className="text-gradient">
            {session.user.name ?? session.user.email}
          </span>{" "}
                  </h1>
        <p className="mt-2 text-muted">
          Tổng quan hệ thống, audit log, integration, AI cost.
        </p>
      </header>

      {/* Quick actions */}
      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/admin/integrations" className="btn-secondary btn-sm">
          Integrations
        </Link>
        <Link href="/admin/lti-tools" className="btn-secondary btn-sm">
          LTI tools
        </Link>
        <a href="/api/exports/admin/users" className="btn-ghost btn-sm">
          Users.csv
        </a>
        <a href="/api/exports/admin/audit" className="btn-ghost btn-sm">
          Audit log.csv
        </a>
        <a href="/api/exports/admin/ai-usage" className="btn-ghost btn-sm">
          AI usage.csv
        </a>
      </div>

      {/* KPI cards */}
      <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Kpi
          label="Tổng users"
          value={totalUsers}
          sub={`+${usersThisWeek} tuần này`}
          icon=""
          tone="brand"
        />
        <Kpi
          label="Khóa published"
          value={courseCountMap.published ?? 0}
          sub={`draft: ${courseCountMap.draft ?? 0}`}
          icon=""
          tone="success"
        />
        <Kpi
          label="Enrollment 7d"
          value={enrollmentsThisWeek}
          icon=""
          tone="brand"
        />
        <Kpi
          label="Events hôm nay"
          value={eventsToday}
          icon=""
          tone="accent"
        />
        <Kpi
          label="AI cost tháng"
          value={`$${aiCostMonth.toFixed(4)}`}
          sub={`${aiTokensMonth.toLocaleString()} tokens`}
          icon=""
          tone="brand"
        />
        <IntegrationKpi label="OpenAI" ok={openaiOk} />
        <IntegrationKpi label="Stripe" ok={stripeOk} optional />
        <IntegrationKpi label="VNPay" ok={vnpayOk} optional />
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        {/* Recent audit log */}
        <section className="card">
          <header className="flex items-baseline justify-between border-b border-token pb-3">
            <h2 className="text-base font-semibold">Audit log gần đây</h2>
            <span className="text-xs text-faint">{auditLogRecent.length}</span>
          </header>
          {auditLogRecent.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Chưa có audit log nào.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {auditLogRecent.map((a) => (
                <li
                  key={a.id}
                  className="rounded-lg border border-token p-3 text-sm"
                >
                  <p className="font-mono text-xs font-semibold text-brand-700">
                    {a.action}
                  </p>
                  <p className="mt-1 text-xs text-faint">
                    <span className="font-medium text-muted">
                      {a.actor?.displayName ?? "system"}
                    </span>{" "}
                    →{" "}
                    <span className="font-medium text-muted">
                      {a.target?.displayName ?? "—"}
                    </span>
                    {" · "}
                    {new Date(a.occurredAt).toLocaleString("vi-VN")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* AI top users this month */}
        <section className="card">
          <header className="flex items-baseline justify-between border-b border-token pb-3">
            <h2 className="text-base font-semibold">Top AI cost tháng này</h2>
            <span className="text-xs text-faint font-mono">{monthKey}</span>
          </header>
          {aiTopUsers.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Chưa có usage AI tháng này.</p>
          ) : (
            <ul className="mt-4 space-y-1.5">
              {aiTopUsers.map(([uid, cost]) => {
                const u = topUserMap.get(uid);
                return (
                  <li
                    key={uid}
                    className="flex items-center gap-3 rounded-lg border border-token p-2.5"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-xs font-semibold text-white">
                      {(u?.displayName ?? "?").charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {u?.displayName ?? uid.slice(0, 8)}
                      </p>
                      <p className="truncate text-xs text-faint">
                        {u?.email ?? ""}
                      </p>
                    </div>
                    <span className="font-mono text-sm font-semibold tabular-nums text-accent-600">
                      ${cost.toFixed(4)}
                    </span>
                  </li>
                );
              })}
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

function IntegrationKpi({
  label,
  ok,
  optional,
}: {
  label: string;
  ok: boolean;
  optional?: boolean;
}) {
  const tone = ok ? "success" : optional ? "default" : "danger";
  const toneStyle = {
    success: "border-success-100 bg-success-50",
    default: "border-token bg-[rgb(var(--surface))]",
    danger: "border-danger-100 bg-danger-50",
  }[tone];
  const valueColor = {
    success: "text-success-600",
    default: "text-faint",
    danger: "text-danger-600",
  }[tone];
  return (
    <div className={`rounded-xl border p-5 shadow-card ${toneStyle}`}>
      <div className="flex items-baseline justify-between">
        <span className="text-xl"></span>
        <span className={`h-display text-2xl font-bold ${valueColor}`}>
          {ok ? "✓" : "—"}
        </span>
      </div>
      <div className="mt-1 text-xs text-muted sm:text-sm">{label}</div>
    </div>
  );
}
