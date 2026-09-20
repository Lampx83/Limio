"use client";

import { usePathname } from "next/navigation";

// Role hiển thị trên header/menu tài khoản. Cột trái do layout của KHU VỰC quyết
// định (/instructor/* luôn là menu giảng viên, /admin/* luôn là menu quản trị),
// còn `activeRole` lấy từ cookie nên có thể lệch — ví dụ cookie "learner" nhưng
// đang mở trang giảng viên qua link/bookmark. Ở khu vực đó, role hiển thị theo
// khu vực (nếu tài khoản thật sự có role đó) để badge, ô chuyển role và menu
// trái luôn nói cùng một điều.
export function useEffectiveRole(activeRole: string | undefined, roles: string[] = []): string | undefined {
  const pathname = usePathname() ?? "";
  if (pathname.startsWith("/instructor") && roles.includes("instructor")) return "instructor";
  if (pathname.startsWith("/admin") && roles.includes("admin")) return "admin";
  return activeRole;
}
