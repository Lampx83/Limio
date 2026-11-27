import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loadPublisherArea } from "@/lib/publisherArea";
import EmptyState from "@/components/ui/EmptyState";
import PublisherReportView from "@/components/report/PublisherReportView";
import PublisherPicker from "@/components/publisher/PublisherPicker";

export const dynamic = "force-dynamic";
export const metadata = { title: "Báo cáo nhà xuất bản" };

/** Báo cáo nhà xuất bản trong khu quản trị: chỉ các khoá của nhà xuất bản đang chọn. Số liệu ẩn danh, như /bao-cao. */
export default async function OrgPublisherReportPage({ searchParams }: { searchParams: { truong?: string; course?: string; range?: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/org-admin/bao-cao");
  const userId = session.user.id;
  const area = await loadPublisherArea(userId, { truong: searchParams.truong });
  if (area.state === "forbidden") return <EmptyState title="Không có quyền" description="Bạn cần là quản trị viên của một nhà xuất bản để xem trang này." />;
  if (area.state === "no_publisher") {
    return <EmptyState title="Tổ chức này không phải nhà xuất bản" description="Báo cáo nhà xuất bản dành cho tổ chức loại nhà xuất bản. Liên hệ quản trị nền tảng nếu cần đổi loại." />;
  }
  return (
    <div>
      <h1 className="h-display text-2xl font-bold">Báo cáo nhà xuất bản</h1>
      <p className="mt-1 text-sm text-muted">{area.org.name}</p>
      {area.orgs.length > 1 && (
        <div className="mt-3">
          <PublisherPicker basePath="/org-admin/bao-cao" orgs={area.orgs} org={area.org} courses={[]} course={null} />
        </div>
      )}
      <div className="mt-4">
        <PublisherReportView
          userId={userId}
          basePath="/org-admin/bao-cao"
          searchParams={searchParams}
          organizationId={area.org.id}
          kicker={false}
          extraQuery={area.orgs.length > 1 ? `&truong=${area.org.id}` : ""}
        />
      </div>
    </div>
  );
}
