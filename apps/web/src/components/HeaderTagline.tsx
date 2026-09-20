"use client";

import { useEffectiveRole } from "./useEffectiveRole";

// "Teach your way" khi đang ở khu giảng viên hoặc role đang chọn là giảng viên.
// Xét cả đường dẫn vì tài khoản có nhiều role (vd. admin) hoặc cookie role cũ
// vẫn có thể vào /instructor mà activeRole không phải "instructor".
export default function HeaderTagline({ activeRole, roles }: { activeRole: string; roles: string[] }) {
  const teach = useEffectiveRole(activeRole, roles) === "instructor";
  return (
    <span className="hidden font-[family-name:var(--font-script)] text-[34px] font-semibold text-muted sm:inline">
      — {teach ? "Teach" : "Learn"} your way
    </span>
  );
}
