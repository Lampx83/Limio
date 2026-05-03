import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@feedbackme/db";
import UserRoleManager from "./UserRoleManager";
import ImpersonateButton from "./ImpersonateButton";

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
            {new Date(user.createdAt).toLocaleDateString("vi-VN")}
            {user.emailVerifiedAt ? (
              <span className="ml-2 chip-success">✓ Email verified</span>
            ) : (
              <span className="ml-2 chip-warning">⚠ Email chưa verify</span>
            )}
          </p>
        </div>
        <ImpersonateButton userId={user.id} userName={user.displayName} />
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Roles */}
        <section className="card">
          <h2 className="mb-3 text-base font-semibold">🛡️ Roles</h2>
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
          <h2 className="mb-3 text-base font-semibold">🔐 Đăng nhập</h2>
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
                    {new Date(p.createdAt).toLocaleDateString("vi-VN")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Audit log */}
        <section className="card lg:col-span-2">
          <h2 className="mb-3 text-base font-semibold">🔒 Audit log gần đây</h2>
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
                    {new Date(a.occurredAt).toLocaleString("vi-VN")}
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
