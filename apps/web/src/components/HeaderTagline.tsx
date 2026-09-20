"use client";

import { usePathname } from "next/navigation";

// "Teach your way" khi đang ở khu giảng viên hoặc role đang chọn là giảng viên.
// Xét cả đường dẫn vì tài khoản có nhiều role (vd. admin) hoặc cookie role cũ
// vẫn có thể vào /instructor mà activeRole không phải "instructor".
export default function HeaderTagline({ activeRole }: { activeRole: string }) {
  const pathname = usePathname() ?? "";
  const teach = activeRole === "instructor" || pathname.startsWith("/instructor");
  return (
    <span className="hidden font-[family-name:var(--font-script)] text-[34px] font-semibold text-muted sm:inline">
      — {teach ? "Teach" : "Learn"} your way
    </span>
  );
}
