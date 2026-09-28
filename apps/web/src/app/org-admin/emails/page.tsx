import { redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { isAnyOrgAdmin, listTemplatesForScope } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import EmailListClient from "../../admin/emails/EmailListClient";

export const dynamic = "force-dynamic";

export default async function OrgEmailsPage({
  searchParams,
}: {
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

  // Chỉ liệt kê (các) trường mà user này là OrgAdmin — không có "Toàn hệ
  // thống" như bên /admin/emails, vì đó là phạm vi của Platform Admin.
  const grants = await prisma.organizationAdmin.findMany({
    where: { userId },
    include: { organization: { select: { id: true, code: true, name: true } } },
    orderBy: { organization: { name: "asc" } },
  });
  if (grants.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-xl font-semibold">Chưa được gán trường nào</h1>
        <p className="mt-2 text-sm text-faint">
          Bạn là Platform Admin nhưng chưa được gán làm OrgAdmin cho trường nào.
        </p>
      </main>
    );
  }
  const scopes = grants.map((g) => ({
    id: g.organization.id,
    label: `${g.organization.name} (${g.organization.code})`,
  }));

  const scopeParam = (searchParams.scope ?? "").trim();
  const isValidScope = scopes.some((s) => s.id === scopeParam);
  const activeScopeId = isValidScope ? scopeParam : scopes[0]!.id;

  const items = await listTemplatesForScope({ organizationId: activeScopeId });

  return (
    <div>
      <div className="mb-6">
        <span className="chip-brand">OrgAdmin</span>
        <h1 className="mt-3 h-display text-2xl font-bold">Mẫu email</h1>
        <p className="mt-1 text-sm text-muted">
          Tuỳ biến nội dung email tự động gửi cho user thuộc trường bạn. Mẫu
          chưa override sẽ dùng theo mẫu chung của nền tảng.
        </p>
      </div>

      <EmailListClient
        scopes={scopes}
        activeScopeId={activeScopeId}
        basePath="/org-admin/emails"
        items={items.map((i) => ({
          ...i,
          updatedAt: i.updatedAt.toISOString(),
        }))}
      />
    </div>
  );
}
