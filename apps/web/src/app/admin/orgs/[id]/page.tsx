import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { listAcademicTerms, listOrgAdmins } from "@feedbackme/core-lms";
import OrgAdminManager from "./OrgAdminManager";
import OrgSettingsClient from "@/app/org-admin/settings/OrgSettingsClient";
import AcademicTermsManager from "@/app/org-admin/settings/AcademicTermsManager";
import { toDayKey } from "@/lib/datetime";

export const dynamic = "force-dynamic";

export default async function AdminOrgDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const org = await prisma.organization.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      code: true,
      name: true,
      brandingLogoUrl: true,
      signatureImageUrl: true,
      signatureName: true,
      signatureTitle: true,
    },
  });
  if (!org) notFound();

  const [admins, terms] = await Promise.all([listOrgAdmins(org.id), listAcademicTerms(org.id)]);

  return (
    <main>
      <Link href="/admin/orgs" className="link mb-3 inline-block text-sm">
        ← Quay lại danh sách
      </Link>

      <header className="card">
        <h1 className="h-display text-2xl font-bold">{org.name}</h1>
        <p className="mt-1 text-xs text-faint">
          Mã: <code className="font-mono">{org.code}</code> · ID:{" "}
          <code className="font-mono">{org.id}</code>
        </p>
      </header>

      <section className="mt-6">
        <h2 className="mb-1 text-base font-semibold">Thông tin &amp; thương hiệu</h2>
        <p className="mb-3 text-xs text-muted">
          Tên trường, logo và chữ ký người đại diện hiện trên chứng nhận hoàn
          thành khoá học do trường cấp. Mã trường là định danh nên không đổi
          được.
        </p>
        <OrgSettingsClient
          organizationId={org.id}
          initialName={org.name}
          initialLogoUrl={org.brandingLogoUrl}
          initialSignatureUrl={org.signatureImageUrl}
          initialSignatureName={org.signatureName}
          initialSignatureTitle={org.signatureTitle}
        />
      </section>

      <section className="mt-6">
        <AcademicTermsManager
          organizationId={org.id}
          initialTerms={terms}
          todayKey={toDayKey(new Date())}
        />
      </section>

      <section className="card mt-6">
        <h2 className="mb-1 text-base font-semibold">OrgAdmin</h2>
        <p className="mb-3 text-xs text-muted">
          Người có quyền quản trị riêng tổ chức này (branding, ca thi, session
          template…). Chỉ Platform Admin mới cấp/thu hồi được ở đây.
        </p>
        <OrgAdminManager
          organizationId={org.id}
          initialAdmins={admins.map((a) => ({
            userId: a.userId,
            email: a.email,
            displayName: a.displayName,
            grantedAt: a.grantedAt.toISOString(),
            grantedByName: a.grantedByName,
          }))}
        />
      </section>
    </main>
  );
}
