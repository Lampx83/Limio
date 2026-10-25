import { redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { getOrgReconciliation, isAnyOrgAdmin } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import { resolveWeek } from "@/lib/weekRange";
import EmptyState from "@/components/ui/EmptyState";
import WeekNav from "@/components/WeekNav";
import ReconciliationClient from "./ReconciliationClient";

export const dynamic = "force-dynamic";

/** Đối chiếu lịch dạy của cả trường theo tuần (CENTER C5.6): ai dạy đúng giờ, trễ, dạy thay, chưa check-in, chưa điểm danh. */
export default async function OrgReconciliationPage({ searchParams }: { searchParams: { tuan?: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/org-admin/doi-chieu");
  const userId = session.user.id;
  if (!(await isAnyOrgAdmin(userId))) {
    return <EmptyState title="Không có quyền" description="Bạn cần là quản trị viên trường để xem trang này." />;
  }
  const adminships = await prisma.organizationAdmin.findMany({
    where: { userId },
    select: { organizationId: true, organization: { select: { name: true, centerEnabled: true } } },
  });
  const primary = adminships[0];
  if (!primary) {
    return <EmptyState title="Chưa được gán trường nào" description="Bạn là Platform Admin nhưng chưa được gán làm OrgAdmin cho trường nào." />;
  }
  if (!primary.organization.centerEnabled) {
    return <EmptyState title="Chưa bật tính năng trung tâm" description="Bật ở mục Thương hiệu & kỳ học để dùng lịch dạy và đối chiếu." />;
  }

  const week = resolveWeek(searchParams.tuan);
  const [report, instructors] = await Promise.all([
    getOrgReconciliation(userId, primary.organizationId, { from: week.from, to: week.to }),
    prisma.courseInstructor.findMany({
      where: { course: { organizationId: primary.organizationId } },
      select: { user: { select: { id: true, displayName: true } } },
    }),
  ]);
  const teachers = [...new Map(instructors.map((i) => [i.user.id, { id: i.user.id, name: i.user.displayName }])).values()].sort((a, b) =>
    a.name.localeCompare(b.name, "vi"),
  );

  return (
    <div>
      <span className="chip-brand">OrgAdmin</span>
      <h1 className="mt-3 h-display text-2xl font-bold">Đối chiếu lịch dạy</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Trường <strong>{primary.organization.name}</strong>. Xem buổi nào dạy đúng giờ, trễ, dạy thay hoặc chưa ai bắt đầu để xếp dạy bù và
        nhắc điểm danh. Đây là đối chiếu với lịch, không phải chấm công.
      </p>
      <div className="mt-4">
        <WeekNav week={week} basePath="/org-admin/doi-chieu" />
      </div>
      <ReconciliationClient organizationId={primary.organizationId} report={report} teachers={teachers} />
    </div>
  );
}
