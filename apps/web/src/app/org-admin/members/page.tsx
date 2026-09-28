import { redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { isAnyOrgAdmin } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import EmptyState from "@/components/ui/EmptyState";
import OrgMembersClient from "./OrgMembersClient";

export const dynamic = "force-dynamic";

export default async function OrgMembersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/org-admin/members");
  const userId = session.user.id;
  if (!(await isAnyOrgAdmin(userId))) {
    return (
      <EmptyState
        title="Không có quyền"
        description="Bạn cần là quản trị viên trường để xem trang này."
      />
    );
  }

  // Find the org this user is OrgAdmin of. If multiple, pick the first —
  // giống quy ước ở /org-admin/settings và /org-admin/session-templates.
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

  return (
    <div>
      <div className="mb-6">
        <span className="chip-brand">OrgAdmin</span>
        <h1 className="mt-3 h-display text-2xl font-bold">Thành viên trường</h1>
        <p className="mt-1 text-sm text-muted">
          Trường <strong>{primary.organization.name}</strong> ({primary.organization.code}). Thêm
          user vào trường theo email — nếu chưa có tài khoản, hệ thống tự tạo và
          gửi email mời đặt mật khẩu.
        </p>
      </div>

      <OrgMembersClient organizationId={primary.organizationId} />
    </div>
  );
}
