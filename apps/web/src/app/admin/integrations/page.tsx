import { redirect } from "next/navigation";

/**
 * Khoá tích hợp đã gộp vào /admin/settings (tab Thanh toán, AI & giọng nói, Phân tích).
 * Giữ đường này vì còn nhiều chỗ trỏ vào: thông báo lỗi AI, tài liệu vận hành, bookmark của admin.
 */
export default function IntegrationsAdminPage() {
  redirect("/admin/settings#ai");
}
