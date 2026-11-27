import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loadPublisherArea } from "@/lib/publisherArea";
import EmptyState from "@/components/ui/EmptyState";
import PublisherPicker from "@/components/publisher/PublisherPicker";
import OrdersRefundPanel from "./OrdersRefundPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Đơn hàng và hoàn tiền" };

/**
 * Đơn hàng và hoàn tiền của nhà xuất bản. Đơn hiện ẩn danh (mã đơn, số tiền, cổng thanh toán): quản trị nhà xuất bản không thấy tên hay email người mua.
 * Hoàn tiền thật làm ở cổng thanh toán; ở đây xác nhận để đơn đổi trạng thái và quyền học của người mua đóng lại.
 */
export default async function PublisherOrdersPage({ searchParams }: { searchParams: { truong?: string; khoa?: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/org-admin/don-hang");
  const area = await loadPublisherArea(session.user.id, searchParams);
  if (area.state === "forbidden") return <EmptyState title="Không có quyền" description="Bạn cần là quản trị viên của một nhà xuất bản để xem trang này." />;
  if (area.state === "no_publisher") {
    return <EmptyState title="Tổ chức này không phải nhà xuất bản" description="Đơn hàng và hoàn tiền dành cho tổ chức loại nhà xuất bản. Liên hệ quản trị nền tảng nếu cần đổi loại." />;
  }
  const { org, orgs, courses, course } = area;
  return (
    <div>
      <h1 className="h-display text-2xl font-bold">Đơn hàng và hoàn tiền</h1>
      <p className="mt-1 text-sm text-muted">
        {org.name}: đơn đã trả tiền của từng khoá. Người mua đọc mã đơn cho thầy/cô tìm; trang không hiện tên hay email người mua.
      </p>
      <div className="mt-4">
        <PublisherPicker basePath="/org-admin/don-hang" orgs={orgs} org={org} courses={courses} course={course} />
      </div>
      <div className="mt-6">
        {course ? (
          <OrdersRefundPanel key={course.id} courseId={course.id} courseTitle={course.title} />
        ) : (
          <EmptyState title="Chưa có khoá nào" description="Nhà xuất bản này chưa có khoá. Nhờ quản trị nền tảng gắn khoá vào tổ chức." />
        )}
      </div>
    </div>
  );
}
