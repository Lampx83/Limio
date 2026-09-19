"use client";

import { usePathname } from "next/navigation";

// Các khu công cụ tương tác (gameshow, công cụ giảng dạy) cần toàn bộ chiều
// rộng vì trình chiếu lên máy chiếu; phần còn lại của /instructor giữ cột đọc 6xl.
const FULL_WIDTH_PREFIXES = ["/instructor/gameshow", "/instructor/teaching-tools"];

export default function InstructorContentFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const full = FULL_WIDTH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  return (
    <div className={`mx-auto w-full px-4 py-6 lg:px-6 ${full ? "" : "max-w-6xl"}`}>
      {children}
    </div>
  );
}
