import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@feedbackme/db";
import { isAnyOrgAdmin } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import OrgSettingsClient from "./OrgSettingsClient";

export const dynamic = "force-dynamic";

export default async function OrgSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/org-admin/settings");
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
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-xl font-semibold">Chưa được gán trường nào</h1>
        <p className="mt-2 text-sm text-faint">
          Bạn là Platform Admin nhưng chưa được gán làm OrgAdmin cho trường nào.
        </p>
      </main>
    );
  }
  const primary = adminships[0]!;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/org-admin/session-templates"
        className="text-sm text-blue-600 hover:underline"
      >
        ← Danh mục ca thi
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Thương hiệu trường</h1>
      <p className="mt-1 text-sm text-faint">
        Trường <strong>{primary.organization.name}</strong> ({primary.organization.code}). Logo
        này hiển thị trên chứng nhận hoàn thành khoá học do trường cấp (
        &quot;Limio × {primary.organization.name}&quot;).
      </p>

      <div className="mt-6">
        <OrgSettingsClient
          organizationId={primary.organizationId}
          initialName={primary.organization.name}
          initialLogoUrl={primary.organization.brandingLogoUrl}
          initialSignatureUrl={primary.organization.signatureImageUrl}
          initialSignatureName={primary.organization.signatureName}
          initialSignatureTitle={primary.organization.signatureTitle}
        />
      </div>
    </main>
  );
}
