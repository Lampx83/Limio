"use client";

import { usePathname } from "next/navigation";

// Các khu công cụ tương tác (gameshow, công cụ giảng dạy) cần toàn bộ chiều
// rộng vì trình chiếu lên máy chiếu; phần còn lại của /instructor giữ cột đọc 6xl.
const FULL_WIDTH_PREFIXES = ["/instructor/gameshow", "/instructor/teaching-tools"];

export default function InstructorContentFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const full = FULL_WIDTH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  // pb-24: chừa chỗ dưới cùng cho nút nổi "Hỏi Lily" (cao ~48px, cách đáy 20px) để cuộn hết trang thì không còn che nội dung.
  // Trang chủ giảng viên không có nút nổi (Lily nằm trong ô tìm kiếm) nên chỉ cần đệm nhỏ: trang vừa một màn hình, không phải cuộn.
  const home = pathname === "/instructor/dashboard";
  return (
    <div className={`mx-auto w-full px-4 lg:px-6 pt-6 ${home ? "pb-3" : "pb-24"} ${full ? "" : "max-w-6xl"}`}>
      {/* key theo đường dẫn: mỗi lần đổi trang nội dung mới hiện dần (chỉ độ trong suốt, không dịch chuyển) thay vì bật ra đột ngột. */}
      {/* animationFillMode "backwards": `both` (mặc định của animate-overlay-in) giữ animation opacity có hiệu lực mãi,
          biến khung này thành stacking context vĩnh viễn nên mọi `fixed z-50` bên trong (bảng Padlet, hộp thoại)
          bị kẹt dưới header sticky z-30. Khung cuối của animation trùng trạng thái tự nhiên nên không cần giữ. */}
      <div
        key={pathname}
        className="animate-overlay-in motion-reduce:animate-none"
        style={{ animationFillMode: "backwards" }}
      >
        {children}
      </div>
    </div>
  );
}
