"use client";

import { usePathname } from "next/navigation";
import { useEffectiveRole } from "./useEffectiveRole";

// "Teach in Flow" khi đang ở khu giảng viên/quản trị hoặc role đang chọn là giảng viên/admin.
// Xét cả đường dẫn vì tài khoản có nhiều role (vd. admin) hoặc cookie role cũ
// vẫn có thể vào /instructor mà activeRole không phải "instructor".
export default function HeaderTagline({
  activeRole,
  roles,
  guest = false,
  languageMode = false,
}: {
  activeRole: string;
  roles: string[];
  guest?: boolean;
  /** LANG L2.1 — vỏ Limio Language: tagline riêng, không phân biệt vai. */
  languageMode?: boolean;
}) {
  const role = useEffectiveRole(activeRole, roles);
  const pathname = usePathname() ?? "";
  // Trang chủ và trang đăng ký giáo viên (trước đăng nhập) quảng bá phía giáo viên;
  // các trang công khai khác giữ Learn.
  const guestTeachPage = pathname === "/" || pathname.startsWith("/register/instructor");
  const teach = role === "instructor" || role === "admin" || (guest && guestTeachPage);
  return (
    <span className="hidden font-[family-name:var(--font-script)] text-base font-normal italic text-lime-700 sm:inline">
      {languageMode ? "Speak in Flow" : teach ? "Teach in Flow" : "Learn in Flow"}
    </span>
  );
}
