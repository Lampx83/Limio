import { redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { EDIT_ROLES } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import { getInstructorCenterAccess } from "@/lib/centerAccess";
import EmptyState from "@/components/ui/EmptyState";
import CenterBoardView from "@/components/center/CenterBoardView";

export const dynamic = "force-dynamic";

/** Bảng điều phối lịch cho chủ khoá / đồng giảng viên của một trường (CENTER M, Q1): thấy các khoá của mình. OrgAdmin dùng /org-admin/dieu-phoi. */
export default async function InstructorBoardPage({ searchParams }: { searchParams: { che_do?: string; ngay?: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/instructor/dieu-phoi");
  const userId = session.user.id;
  if (!(await getInstructorCenterAccess(userId))) redirect("/instructor/dashboard");
  const course = await prisma.courseInstructor.findFirst({
    where: { userId, role: { in: [...EDIT_ROLES] }, course: { organizationId: { not: null } } },
    select: { course: { select: { organization: { select: { id: true, name: true, centerEnabled: true } } } } },
    orderBy: { createdAt: "asc" },
  });
  const org = course?.course.organization;
  return (
    <main>
      <h1 className="text-h1">Điều phối lịch</h1>
      <p className="mt-1 text-sm text-muted">Các buổi thuộc khoá thầy/cô quản lý: mỗi khối là một buổi học, vạch hồng là bây giờ.</p>
      <div className="mt-4">
        {org && !org.centerEnabled ? (
          <EmptyState title="Chưa bật tính năng trung tâm" description="Nhờ quản trị trường bật “Tính năng trung tâm” để dùng bảng điều phối." />
        ) : org ? (
          <CenterBoardView userId={userId} organizationId={org.id} orgName={org.name} basePath="/instructor/dieu-phoi" searchParams={searchParams} />
        ) : (
          <EmptyState title="Chưa có khoá thuộc trường" description="Bảng điều phối hiện các khoá do thầy/cô quản lý và thuộc một trường đã bật tính năng trung tâm." />
        )}
      </div>
    </main>
  );
}
