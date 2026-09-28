import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@feedbackme/db";
import { isAnyOrgAdmin, getTemplateForScope } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import EmailEditorClient from "../../../admin/emails/[key]/EmailEditorClient";

export const dynamic = "force-dynamic";

export default async function OrgEmailEditPage({
  params,
  searchParams,
}: {
  params: { key: string };
  searchParams: { scope?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/org-admin/emails");
  const userId = session.user.id;
  if (!(await isAnyOrgAdmin(userId))) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-xl font-semibold">Không có quyền</h1>
        <p className="mt-2 text-sm text-faint">
          Bạn cần là quản trị viên trường để xem trang này.
        </p>
      </main>
    );
  }

  const grants = await prisma.organizationAdmin.findMany({
    where: { userId },
    include: { organization: { select: { id: true, code: true, name: true } } },
    orderBy: { organization: { name: "asc" } },
  });
  if (grants.length === 0) notFound();
  const scopes = grants.map((g) => ({
    id: g.organization.id,
    label: `${g.organization.name} (${g.organization.code})`,
  }));

  const key = decodeURIComponent(params.key);
  const scopeParam = (searchParams.scope ?? "").trim();
  const isValidScope = scopes.some((s) => s.id === scopeParam);
  const activeScopeId = isValidScope ? scopeParam : scopes[0]!.id;

  const detail = await getTemplateForScope(key, { organizationId: activeScopeId });
  if (!detail) notFound();

  return (
    <div>
      <div className="mb-4">
        <Link
          href={`/org-admin/emails?scope=${activeScopeId}`}
          className="text-sm text-brand-700 hover:underline"
        >
          ← Quay lại danh sách
        </Link>
      </div>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="chip-brand">Email template</span>
          <h1 className="mt-2 h-display text-2xl font-bold">{detail.name}</h1>
          <p className="mt-1 text-sm text-muted">{detail.description ?? "—"}</p>
          <p className="mt-1 text-xs text-faint">
            Phạm vi: <strong>{scopes.find((s) => s.id === activeScopeId)?.label}</strong>
            {" · "}
            {detail.effectiveSource === "org"
              ? "Đã override cho trường này"
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
