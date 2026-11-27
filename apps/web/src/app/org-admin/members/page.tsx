import { redirect } from "next/navigation";
import { isAnyOrgAdmin } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import { activeAdminships } from "@/lib/activeOrg";
import EmptyState from "@/components/ui/EmptyState";
import OrgMembersClient from "./OrgMembersClient";
import ReportViewersSection from "./ReportViewersSection";

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

  // Tổ chức đang chọn của khu quản trị.
  const adminships = await activeAdminships(userId, { name: true, code: true, kind: true });
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

      <OrgMembersClient organizationId={primary.organizationId} isCenter={primary.organization.kind === "center"} />
      <ReportViewersSection organizationId={primary.organizationId} />
    </div>
  );
}
