import { redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { isAnyOrgAdmin, listAcademicTerms } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import EmptyState from "@/components/ui/EmptyState";
import OrgSettingsClient from "./OrgSettingsClient";
import AcademicTermsManager from "./AcademicTermsManager";
import { toDayKey } from "@/lib/datetime";

export const dynamic = "force-dynamic";

export default async function OrgSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/org-admin/settings");
  const userId = session.user.id;
  if (!(await isAnyOrgAdmin(userId))) {
    return (
      <EmptyState
        title="Không có quyền"
        description="Bạn cần là quản trị viên trường để xem trang này."
      />
    );
  }

  // Find the org this user is OrgAdmin of. If multiple, pick the first.
  const adminships = await prisma.organizationAdmin.findMany({
    where: { userId },
    select: {
      organizationId: true,
      organization: {
        select: {
          name: true,
          code: true,
          brandingLogoUrl: true,
          signatureImageUrl: true,
          signatureName: true,
          signatureTitle: true,
        },
      },
    },
  });
  if (adminships.length === 0) {
    return (
      <EmptyState
        title="Chưa được gán trường nào"
        description="Bạn là Platform Admin nhưng chưa được gán làm OrgAdmin cho trường nào."
      />
    );
  }
  const primary = adminships[0]!;
  const terms = await listAcademicTerms(primary.organizationId);

  return (
    <div>
      <div className="mb-6">
        <span className="chip-brand">OrgAdmin</span>
        <h1 className="mt-3 h-display text-2xl font-bold">Thương hiệu &amp; kỳ học</h1>
        <p className="mt-1 text-sm text-muted">
          Trường <strong>{primary.organization.name}</strong> ({primary.organization.code}). Logo
          này hiển thị trên chứng nhận hoàn thành khoá học do trường cấp (
          &quot;Limio × {primary.organization.name}&quot;).
        </p>
      </div>

      <OrgSettingsClient
        organizationId={primary.organizationId}
        initialName={primary.organization.name}
        initialLogoUrl={primary.organization.brandingLogoUrl}
        initialSignatureUrl={primary.organization.signatureImageUrl}
        initialSignatureName={primary.organization.signatureName}
        initialSignatureTitle={primary.organization.signatureTitle}
      />

      <div className="mt-6">
        <AcademicTermsManager
          organizationId={primary.organizationId}
          initialTerms={terms}
          todayKey={toDayKey(new Date())}
        />
      </div>
    </div>
  );
}
