import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@feedbackme/db";
import UserRoleManager from "./UserRoleManager";
import ImpersonateButton from "./ImpersonateButton";
import { formatDate, formatDateTime } from "@/lib/datetime";

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      email: true,
      displayName: true,
      avatarUrl: true,
      emailVerifiedAt: true,
      createdAt: true,
      locale: true,
      timezone: true,
      authProviders: {
        select: { id: true, provider: true, providerUserId: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
      userRoles: {
        select: {
          id: true,
          courseId: true,
          grantedAt: true,
          role: { select: { name: true } },
          course: { select: { title: true } },
        },
        orderBy: { grantedAt: "asc" },
      },
    },
  });

  if (!user) notFound();

  const auditLogs = await prisma.auditLog.findMany({
    where: {
      OR: [{ targetUserId: user.id }, { actorUserId: user.id }],
    },
    orderBy: { occurredAt: "desc" },
    take: 20,
    include: {
      actor: { select: { displayName: true, email: true } },
      target: { select: { displayName: true, email: true } },
    },
  });

  // ── AI usage của user này (cost/tokens/turns) ──
  const [aiAgg, aiByModel, aiRows] = await Promise.all([
    prisma.aiUsageLog.aggregate({
      where: { userId: user.id },
      _sum: {
        costUsd: true,
        tokensInput: true,
        tokensOutput: true,
        turns: true,
      },
    }),
    prisma.aiUsageLog.groupBy({
      by: ["model"],
      where: { userId: user.id },
      _sum: {
        costUsd: true,
        tokensInput: true,
        tokensOutput: true,
        turns: true,
      },
      orderBy: { _sum: { costUsd: "desc" } },
    }),
    prisma.aiUsageLog.findMany({
      where: { userId: user.id },
      orderBy: [{ dayKey: "desc" }, { model: "asc" }],
      take: 60,
      select: {
        dayKey: true,
        model: true,
        tokensInput: true,
        tokensOutput: true,
        costUsd: true,
        turns: true,
      },
    }),
  ]);
  const aiTotalCost = aiAgg._sum.costUsd ?? 0;
  const aiTotalTokens =
    (aiAgg._sum.tokensInput ?? 0) + (aiAgg._sum.tokensOutput ?? 0);
  const aiTotalTurns = aiAgg._sum.turns ?? 0;

  return (
    <main>
      <Link
        href="/admin/users"
        className="link mb-3 inline-block text-sm"
      >
        ← Quay lại danh sách
      </Link>

      <header className="card flex flex-wrap items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-gradient text-lg font-bold text-white">
          {(user.displayName || user.email).charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="h-display text-2xl font-bold">{user.displayName}</h1>
          <p className="text-sm text-muted">{user.email}</p>
          <p className="mt-1 text-xs text-faint">
            ID: <code className="font-mono">{user.id}</code> · Tham gia{" "}
            {formatDate(user.createdAt)}
            {user.emailVerifiedAt ? (
              <span className="ml-2 chip-success">✓ Email verified</span>
            ) : (
              <span className="ml-2 chip-warning">Email chưa verify</span>
            )}
          </p>
        </div>
        <ImpersonateButton userId={user.id} userName={user.displayName} />
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Roles */}
        <section className="card">
          <h2 className="mb-3 text-base font-semibold">Roles</h2>
          <UserRoleManager
            userId={user.id}
            initialRoles={user.userRoles.map((ur) => ({
              userRoleId: ur.id,
              roleName: ur.role.name,
              courseId: ur.courseId,
              courseTitle: ur.course?.title ?? null,
              grantedAt: ur.grantedAt.toISOString(),
            }))}
          />
        </section>

        {/* Auth providers */}
        <section className="card">
          <h2 className="mb-3 text-base font-semibold">Đăng nhập</h2>
          {user.authProviders.length === 0 ? (
            <p className="text-sm text-muted">Không có provider nào.</p>
          ) : (
            <ul className="space-y-1.5">
              {user.authProviders.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-token p-2.5 text-sm"
                >
                  <div>
                    <span className="font-medium capitalize">{p.provider}</span>
                    <p className="font-mono text-xs text-faint">
                      {p.providerUserId}
                    </p>
                  </div>
                  <span className="text-xs text-faint">
                    {formatDate(p.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* AI usage */}
        <section className="card lg:col-span-2">
          <h2 className="mb-3 text-base font-semibold">AI usage</h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-token p-3">
              <p className="text-xs text-faint">Tổng chi phí</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums">
                ${aiTotalCost.toFixed(4)}
              </p>
            </div>
            <div className="rounded-lg border border-token p-3">
              <p className="text-xs text-faint">Tổng tokens</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums">
                {aiTotalTokens.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border border-token p-3">
              <p className="text-xs text-faint">Lượt chat</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums">
                {aiTotalTurns.toLocaleString()}
              </p>
            </div>
          </div>

          {aiByModel.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              User này chưa dùng AI (tutor / feedback).
            </p>
          ) : (
            <>
              {/* Theo model */}
              <h3 className="mt-4 mb-1.5 text-xs font-semibold uppercase text-faint">
                Theo model
              </h3>
              <div className="overflow-x-auto rounded-lg border border-token">
                <table className="w-full text-sm">
                  <thead className="bg-[rgb(var(--surface-muted))] text-left text-xs text-faint">
                    <tr>
                      <th className="px-3 py-1.5 font-medium">Model</th>
                      <th className="px-3 py-1.5 font-medium">Tokens</th>
                      <th className="px-3 py-1.5 font-medium">Lượt</th>
                      <th className="px-3 py-1.5 text-right font-medium">Chi phí</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-token">
                    {aiByModel.map((m) => (
                      <tr key={m.model}>
                        <td className="px-3 py-1.5 font-mono text-xs">{m.model}</td>
                        <td className="px-3 py-1.5 tabular-nums">
                          {(
                            (m._sum.tokensInput ?? 0) +
                            (m._sum.tokensOutput ?? 0)
                          ).toLocaleString()}
                        </td>
                        <td className="px-3 py-1.5 tabular-nums">
                          {(m._sum.turns ?? 0).toLocaleString()}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          ${(m._sum.costUsd ?? 0).toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Theo ngày (60 dòng gần nhất) */}
              <h3 className="mt-4 mb-1.5 text-xs font-semibold uppercase text-faint">
                Theo ngày (gần nhất)
              </h3>
              <div className="max-h-72 overflow-auto rounded-lg border border-token">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-[rgb(var(--surface-muted))] text-left text-xs text-faint">
                    <tr>
                      <th className="px-3 py-1.5 font-medium">Ngày</th>
                      <th className="px-3 py-1.5 font-medium">Model</th>
                      <th className="px-3 py-1.5 font-medium">Tokens (in/out)</th>
                      <th className="px-3 py-1.5 font-medium">Lượt</th>
                      <th className="px-3 py-1.5 text-right font-medium">Chi phí</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-token">
                    {aiRows.map((r, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1.5 tabular-nums">{r.dayKey}</td>
                        <td className="px-3 py-1.5 font-mono text-xs">{r.model}</td>
                        <td className="px-3 py-1.5 tabular-nums text-faint">
                          {r.tokensInput.toLocaleString()}/
                          {r.tokensOutput.toLocaleString()}
                        </td>
                        <td className="px-3 py-1.5 tabular-nums">{r.turns}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          ${r.costUsd.toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        {/* Audit log */}
        <section className="card lg:col-span-2">
          <h2 className="mb-3 text-base font-semibold">Audit log gần đây</h2>
          {auditLogs.length === 0 ? (
            <p className="text-sm text-muted">Chưa có audit log nào.</p>
          ) : (
            <ul className="space-y-1.5">
              {auditLogs.map((a) => (
                <li
                  key={a.id}
                  className="rounded-lg border border-token p-2.5 text-sm"
                >
                  <p className="font-mono text-xs font-semibold text-brand-700">
                    {a.action}
                  </p>
                  <p className="mt-0.5 text-xs text-faint">
                    <span className="text-muted">
                      {a.actor?.displayName ?? "system"}
                    </span>{" "}
                    →{" "}
                    <span className="text-muted">
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
      </div>
    </main>
  );
}
