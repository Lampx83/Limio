import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@feedbackme/db";
import { getTemplateForScope } from "@feedbackme/core-lms";
import EmailEditorClient from "./EmailEditorClient";

export const dynamic = "force-dynamic";

export default async function AdminEmailEditPage({
  params,
  searchParams,
}: {
  params: { key: string };
  searchParams: { scope?: string };
}) {
  const key = decodeURIComponent(params.key);
  const scopeParam = (searchParams.scope ?? "global").trim();

  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });
  const scopes = [
    { id: "global", label: "Toàn hệ thống (mặc định)" },
    ...orgs.map((o) => ({ id: o.id, label: `${o.name} (${o.code})` })),
  ];
  const isValidScope = scopes.some((s) => s.id === scopeParam);
  const activeScopeId = isValidScope ? scopeParam : "global";

  const detail = await getTemplateForScope(
    key,
    activeScopeId === "global"
      ? "global"
      : { organizationId: activeScopeId },
  );
  if (!detail) notFound();

  return (
    <div>
      <div className="mb-4">
        <Link
          href={`/admin/emails?scope=${activeScopeId}`}
          className="text-sm text-brand-700 hover:underline"
        >
          ← Quay lại danh sách
        </Link>
      </div>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="chip-brand">Email template</span>
          <h1 className="mt-2 h-display text-2xl font-bold">{detail.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {detail.description ?? "—"}
          </p>
          <p className="mt-1 text-xs text-faint">
            Phạm vi: <strong>{scopes.find((s) => s.id === activeScopeId)?.label}</strong>
            {" · "}
            {detail.effectiveSource === "org"
              ? "Đã override cho trường này"
              : activeScopeId === "global"
                ? "Mẫu chung"
                : "Đang kế thừa từ mẫu chung"}
          </p>
        </div>
      </div>

      <EmailEditorClient
        key_={detail.key}
        scopeId={activeScopeId}
        initial={{
          subject: detail.subject,
          bodyHtml: detail.bodyHtml,
          bodyText: detail.bodyText ?? "",
          enabled: detail.enabled,
          overriddenForScope: detail.overriddenForScope,
          variables: detail.variables,
        }}
      />
    </div>
  );
}
