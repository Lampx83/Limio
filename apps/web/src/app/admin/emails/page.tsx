import { prisma } from "@feedbackme/db";
import { listTemplatesForScope } from "@feedbackme/core-lms";
import EmailListClient from "./EmailListClient";

export const dynamic = "force-dynamic";

export default async function AdminEmailsPage({
  searchParams,
}: {
  searchParams: { scope?: string };
}) {
  const scopeParam = (searchParams.scope ?? "global").trim();

  // Platform admin (admin/layout already gated this) can see global + every org.
  const orgs = await prisma.organization.findMany({
    select: { id: true, code: true, name: true },
    orderBy: { name: "asc" },
  });
  const scopes = [
    { id: "global", label: "Toàn hệ thống (mặc định)" },
    ...orgs.map((o) => ({ id: o.id, label: `${o.name} (${o.code})` })),
  ];

  const isValidScope = scopes.some((s) => s.id === scopeParam);
  const activeScopeId = isValidScope ? scopeParam : "global";

  const items = await listTemplatesForScope(
    activeScopeId === "global"
      ? "global"
      : { organizationId: activeScopeId },
  );

  return (
    <div>
      <div className="mb-6">
        <span className="chip-brand">Admin</span>
        <h1 className="mt-3 h-display text-2xl font-bold">Email templates</h1>
        <p className="mt-1 text-sm text-muted">
          Quản lý nội dung email tự động gửi cho người dùng. Có thể tuỳ biến
          riêng cho từng trường (override) hoặc dùng mẫu chung toàn hệ thống.
        </p>
      </div>

      <EmailListClient
        scopes={scopes}
        activeScopeId={activeScopeId}
        items={items.map((i) => ({
          ...i,
          updatedAt: i.updatedAt.toISOString(),
        }))}
      />
    </div>
  );
}
