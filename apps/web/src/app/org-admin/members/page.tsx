import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@feedbackme/db";
import { isAnyOrgAdmin } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import OrgMembersClient from "./OrgMembersClient";

export const dynamic = "force-dynamic";

export default async function OrgMembersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/org-admin/members");
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
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex items-center justify-between">
        <Link href="/instructor/dashboard" className="text-sm text-blue-600 hover:underline">
          ← Dashboard
        </Link>
        <Link href="/org-admin/settings" className="text-sm text-blue-600 hover:underline">
          Thương hiệu trường →
        </Link>
      </div>
      <h1 className="mt-3 text-2xl font-bold">👥 Thành viên trường</h1>
      <p className="mt-1 text-sm text-faint">
        Trường <strong>{primary.organization.name}</strong> ({primary.organization.code}). Thêm
        user vào trường theo email — nếu chưa có tài khoản, hệ thống tự tạo và
        gửi email mời đặt mật khẩu.
      </p>

      <div className="mt-6">
        <OrgMembersClient organizationId={primary.organizationId} />
      </div>
    </main>
  );
}
