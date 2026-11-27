import Link from "next/link";
import { redirect } from "next/navigation";
import { isAnyOrgAdmin } from "@feedbackme/core-lms";
import { listManagedCenterOrgs } from "@/lib/orgAdminOrgs";
import { auth } from "@/lib/auth";
import EmptyState from "@/components/ui/EmptyState";
import CenterBoardView from "@/components/center/CenterBoardView";

export const dynamic = "force-dynamic";

/**
 * Bảng điều phối lịch của một trường (CENTER M): vạch "bây giờ", khối ngang là buổi học hoặc vòng đời lớp.
 * Quản trị nhiều trường, hoặc Platform Admin, chọn trường bằng `?truong=` (Platform Admin thấy mọi trường đã bật tính năng trung tâm).
 */
export default async function OrgBoardPage({ searchParams }: { searchParams: { che_do?: string; ngay?: string; truong?: string; chu_y?: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/org-admin/dieu-phoi");
  const userId = session.user.id;
  if (!(await isAnyOrgAdmin(userId))) {
    return <EmptyState title="Không có quyền" description="Bạn cần là quản trị viên trường để xem trang này." />;
  }
  const { orgs, platform, anyAdminship } = await listManagedCenterOrgs(userId);
  if (orgs.length === 0) {
    return anyAdminship || platform ? (
      <EmptyState title="Tổ chức này không phải trung tâm" description="Bảng điều phối dành cho tổ chức loại trung tâm. Liên hệ quản trị nền tảng nếu cần đổi loại." />
    ) : (
      <EmptyState title="Chưa được gán trường nào" description="Bạn chưa được gán làm quản trị viên cho trường nào." />
    );
  }
  const org = orgs.find((o) => o.id === searchParams.truong) ?? orgs[0]!;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="h-display text-2xl font-bold">Điều phối lịch</h1>
        <span className="chip-brand">OrgAdmin</span>
      </div>
      <p className="mt-1 text-sm text-muted">{org.name}: mỗi khối là một buổi học, vạch hồng là bây giờ.</p>
      {orgs.length > 1 && (
        <nav className="mt-3 flex flex-wrap items-center gap-2 text-sm" aria-label="Chọn trường">
          <span className="text-muted">Trường</span>
          {orgs.map((o) => (
            <Link key={o.id} href={`/org-admin/dieu-phoi?truong=${o.id}`} aria-current={o.id === org.id ? "page" : undefined} className={`btn-pill ${o.id === org.id ? "!bg-brand-500 !text-white" : ""}`}>
              {o.name}
            </Link>
          ))}
        </nav>
      )}
      <div className="mt-4">
        <CenterBoardView userId={userId} organizationId={org.id} orgName={org.name} basePath="/org-admin/dieu-phoi" orgParam={orgs.length > 1 ? org.id : undefined} searchParams={searchParams} />
      </div>
    </div>
  );
}
