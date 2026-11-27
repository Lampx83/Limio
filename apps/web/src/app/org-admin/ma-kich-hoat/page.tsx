import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loadPublisherArea } from "@/lib/publisherArea";
import EmptyState from "@/components/ui/EmptyState";
import PublisherPicker from "@/components/publisher/PublisherPicker";
import AccessCodesPanel from "@/app/instructor/courses/[id]/AccessCodesPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mã kích hoạt" };

/**
 * Mã kích hoạt theo lô của một nhà xuất bản: chọn khoá rồi tạo lô, xuất CSV cho nhà in, thu hồi. Dùng lại đúng bảng điều khiển của giảng viên;
 * quyền ở các route `/api/courses/[id]/access-code*` (assertCanManageCourseSales).
 */
export default async function PublisherCodesPage({ searchParams }: { searchParams: { truong?: string; khoa?: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/org-admin/ma-kich-hoat");
  const area = await loadPublisherArea(session.user.id, searchParams);
  if (area.state === "forbidden") return <EmptyState title="Không có quyền" description="Bạn cần là quản trị viên của một nhà xuất bản để xem trang này." />;
  if (area.state === "no_publisher") {
    return <EmptyState title="Tổ chức này không phải nhà xuất bản" description="Mã kích hoạt theo lô dành cho tổ chức loại nhà xuất bản. Liên hệ quản trị nền tảng nếu cần đổi loại." />;
  }
  const { org, orgs, courses, course } = area;
  const sellable = course && course.priceCents !== null && course.priceCents > 0 && course.enrollMode === "open";
  return (
    <div>
      <h1 className="h-display text-2xl font-bold">Mã kích hoạt</h1>
      <p className="mt-1 text-sm text-muted">{org.name}: mỗi lô là một đợt in. Tạo lô, xuất file cho nhà in, theo dõi số mã đã kích hoạt, thu hồi cả lô nếu in sai.</p>
      <div className="mt-4">
        <PublisherPicker basePath="/org-admin/ma-kich-hoat" orgs={orgs} org={org} courses={courses} course={course} />
      </div>
      <div className="mt-6">
        {!course ? (
          <EmptyState title="Chưa có khoá nào" description="Nhà xuất bản này chưa có khoá. Nhờ quản trị nền tảng gắn khoá vào tổ chức." />
        ) : sellable ? (
          <>
            <h2 className="text-h3 mb-3">{course.title}</h2>
            <AccessCodesPanel courseId={course.id} reportHref={`/org-admin/bao-cao?course=${course.id}${orgs.length > 1 ? `&truong=${org.id}` : ""}`} />
          </>
        ) : (
          <EmptyState
            title="Khoá này chưa bán bằng mã"
            description="Mã kích hoạt chỉ dùng cho khoá có giá và cho phép ghi danh mở. Nhờ giảng viên chủ khoá đặt giá, hoặc chọn khoá khác."
          />
        )}
      </div>
    </div>
  );
}
