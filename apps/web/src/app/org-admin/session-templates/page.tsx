import { redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { listSessionTemplates, isAnyOrgAdmin } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import EmptyState from "@/components/ui/EmptyState";
import SessionTemplatesClient from "./SessionTemplatesClient";

export const dynamic = "force-dynamic";

export default async function SessionTemplatesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/org-admin/session-templates");
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
      organization: { select: { name: true, code: true } },
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
  const templates = await listSessionTemplates(primary.organizationId);

  return (
    <div>
      <div className="mb-6">
        <span className="chip-brand">OrgAdmin</span>
        <h1 className="mt-3 h-display text-2xl font-bold">Danh mục ca thi</h1>
        <p className="mt-1 text-sm text-muted">
          Trường <strong>{primary.organization.name}</strong> ({primary.organization.code}). Đặt
          sẵn các ca chuẩn (mã + giờ), khi tạo đợt thi mới chỉ cần pick template
          + chọn ngày → hệ thống auto sinh ca thi với giờ tương ứng.
        </p>
      </div>

      <SessionTemplatesClient
        organizationId={primary.organizationId}
        initial={templates}
      />
    </div>
  );
}
