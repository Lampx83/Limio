import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@feedbackme/db";
import { listSessionTemplates, isAnyOrgAdmin } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import SessionTemplatesClient from "./SessionTemplatesClient";

export const dynamic = "force-dynamic";

export default async function SessionTemplatesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/org-admin/session-templates");
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
  const templates = await listSessionTemplates(primary.organizationId);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link
        href="/instructor/dashboard"
        className="text-sm text-blue-600 hover:underline"
      >
        ← Dashboard
      </Link>
      <h1 className="mt-3 text-2xl font-bold">📅 Danh mục ca thi</h1>
      <p className="mt-1 text-sm text-faint">
        Trường <strong>{primary.organization.name}</strong> ({primary.organization.code}). Đặt
        sẵn các ca chuẩn (mã + giờ), khi tạo đợt thi mới chỉ cần pick template
        + chọn ngày → hệ thống auto sinh ca thi với giờ tương ứng.
      </p>

      <div className="mt-6">
        <SessionTemplatesClient
          organizationId={primary.organizationId}
          initial={templates}
        />
      </div>
    </main>
  );
}
