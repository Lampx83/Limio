import Link from "next/link";
import { redirect } from "next/navigation";
import { CourseAuthzError, getOrgOverview, isAnyOrgAdmin, recordRiskListViewed } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import { listManagedCenterOrgs } from "@/lib/orgAdminOrgs";
import { todayVN } from "@/lib/weekRange";
import EmptyState from "@/components/ui/EmptyState";
import OverviewView from "@/components/center/OverviewView";

export const dynamic = "force-dynamic";

/** Tổng quan trung tâm (CENTER L): hôm nay, lớp, giáo viên, học viên cần liên hệ. Chỉ quản trị trường và Platform Admin. */
export default async function CenterOverviewPage({ searchParams }: { searchParams: { truong?: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/org-admin/tong-quan");
  const userId = session.user.id;
  if (!(await isAnyOrgAdmin(userId))) {
    return <EmptyState title="Không có quyền" description="Bạn cần là quản trị viên trường để xem trang này." />;
  }
  const { orgs, platform, anyAdminship } = await listManagedCenterOrgs(userId);
  if (orgs.length === 0) {
    return anyAdminship || platform ? (
      <EmptyState title="Tổ chức này không phải trung tâm" description="Trang này dành cho tổ chức loại trung tâm. Liên hệ quản trị nền tảng nếu cần đổi loại." />
    ) : (
      <EmptyState title="Chưa được gán trường nào" description="Bạn chưa được gán làm quản trị viên cho trường nào." />
    );
  }
  const org = orgs.find((o) => o.id === searchParams.truong) ?? orgs[0]!;
  const orgQuery = orgs.length > 1 ? `?truong=${org.id}` : "";
  let overview;
  try {
    overview = await getOrgOverview(userId, org.id, todayVN());
  } catch (e) {
    if (e instanceof CourseAuthzError) return <EmptyState title="Không có quyền" description="Tổng quan trung tâm dành cho quản trị viên của trường này." />;
    throw e;
  }
  // Mở danh sách có tên học viên thì ghi một sự kiện mỗi ngày (payload chỉ id và số dòng).
  if (overview.atRisk.length > 0) await recordRiskListViewed(userId, org.id, overview.today, overview.atRisk.length).catch(() => undefined);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="h-display text-2xl font-bold">Tổng quan trung tâm</h1>
        <span className="chip-brand">OrgAdmin</span>
      </div>
      <p className="mt-1 text-sm text-muted">{org.name}: tình hình hôm nay, lớp, giáo viên và học viên cần liên hệ.</p>
      {orgs.length > 1 && (
        <nav className="mt-3 flex flex-wrap items-center gap-2 text-sm" aria-label="Chọn trường">
          <span className="text-muted">Trường</span>
          {orgs.map((o) => (
            <Link key={o.id} href={`/org-admin/tong-quan?truong=${o.id}`} aria-current={o.id === org.id ? "page" : undefined} className={`btn-pill ${o.id === org.id ? "!bg-brand-500 !text-white" : ""}`}>
              {o.name}
            </Link>
          ))}
        </nav>
      )}
      <div className="mt-6">
        <OverviewView o={overview} boardPath={`/org-admin/dieu-phoi${orgQuery}`} reconPath="/org-admin/doi-chieu" />
      </div>
    </div>
  );
}
