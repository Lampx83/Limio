import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getGa4Summary,
  getIntegrationSecret,
  isAdmin,
  listIntegrationStatuses,
  type Ga4Summary,
} from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import { formatDateTime } from "@/lib/datetime";

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
  const ga4Ok =
    (integrations.find((i) => i.key === "ga4.property_id")?.hasValue ?? false) &&
    (integrations.find((i) => i.key === "ga4.service_account")?.hasValue ?? false);

  // GA4 chỉ cho traffic/acquisition tổng hợp (§4.8, §5.4 CLAUDE.md) — hành vi
  // học chi tiết dùng LearningEvent. Lỗi gọi API không được làm sập cả trang.
  let ga4Summary: Ga4Summary | null = null;
  let ga4Error: string | null = null;
  if (ga4Ok) {
    try {
      const [propertyId, serviceAccountJson] = await Promise.all([
        getIntegrationSecret("ga4.property_id"),
        getIntegrationSecret("ga4.service_account"),
      ]);
      ga4Summary = await getGa4Summary(propertyId, serviceAccountJson);
    } catch (e) {
      ga4Error = (e as Error).message ?? "unknown_error";
    }
  }

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
        <IntegrationKpi label="Google Analytics" ok={ga4Ok} optional />
      </section>

      {/* GA4 — traffic & acquisition (aggregate, không phải hành vi học chi
          tiết — cái đó nằm ở LearningEvent) */}
      {ga4Ok && (
        <section className="card mt-8">
          <header className="flex items-baseline justify-between border-b border-token pb-3">
            <h2 className="text-base font-semibold">
              Google Analytics — 7 ngày qua
            </h2>
            <Link href="/admin/integrations" className="text-xs text-faint hover:underline">
              Cấu hình
            </Link>
          </header>
          {ga4Error ? (
            <p className="mt-4 rounded-lg border border-danger-100 bg-danger-50 p-3 text-sm text-danger-700">
              Không lấy được dữ liệu GA4: {ga4Error}
            </p>
          ) : ga4Summary ? (
            <div className="mt-4 space-y-6">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-token p-3 text-center">
                  <p className="h-display text-xl font-bold tabular-nums text-brand-600">
                    {ga4Summary.activeUsers7d.toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs text-muted">Active users</p>
                </div>
                <div className="rounded-lg border border-token p-3 text-center">
                  <p className="h-display text-xl font-bold tabular-nums text-brand-600">
                    {ga4Summary.sessions7d.toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs text-muted">Sessions</p>
                </div>
                <div className="rounded-lg border border-token p-3 text-center">
                  <p className="h-display text-xl font-bold tabular-nums text-brand-600">
                    {ga4Summary.newUsers7d.toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs text-muted">New users</p>
                </div>
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <h3 className="text-xs font-semibold uppercase text-faint">
                    Top trang
                  </h3>
                  {ga4Summary.topPages.length === 0 ? (
                    <p className="mt-2 text-sm text-muted">Chưa có dữ liệu.</p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {ga4Summary.topPages.map((p) => (
                        <li
                          key={p.path}
                          className="flex items-center justify-between gap-3 text-sm"
                        >
                          <span className="truncate font-mono text-xs text-muted">
                            {p.path}
                          </span>
                          <span className="shrink-0 font-mono text-xs font-semibold tabular-nums">
                            {p.views.toLocaleString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <h3 className="text-xs font-semibold uppercase text-faint">
                    Kênh truy cập
                  </h3>
                  {ga4Summary.channels.length === 0 ? (
                    <p className="mt-2 text-sm text-muted">Chưa có dữ liệu.</p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {ga4Summary.channels.map((c) => (
                        <li
                          key={c.channel}
                          className="flex items-center justify-between gap-3 text-sm"
                        >
                          <span className="text-muted">{c.channel}</span>
                          <span className="font-mono text-xs font-semibold tabular-nums">
                            {c.sessions.toLocaleString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </section>
      )}

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
                    {formatDateTime(a.occurredAt)}
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
