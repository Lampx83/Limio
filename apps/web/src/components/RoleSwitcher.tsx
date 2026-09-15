"use client";

import { useState } from "react";
import { apiUrl, withBasePath } from "@/lib/apiUrl";
import { toast } from "@/lib/toast";

const ROLE_LABELS: Record<string, string> = {
  learner: "Học viên",
  instructor: "Giảng viên",
  admin: "Quản trị",
  mentor: "Mentor",
};

const ROLE_DEFAULT_PATH: Record<string, string> = {
  admin: "/admin/dashboard",
  instructor: "/instructor/dashboard",
  mentor: "/me/dashboard",
  learner: "/me/dashboard",
};

export default function RoleSwitcher({
  roles,
  activeRole,
  variant = "switch",
}: {
  roles: string[];
  activeRole: string;
  variant?: "header" | "switch";
}) {
  const [busy, setBusy] = useState(false);

  if (roles.length <= 1) return null;

  async function switchTo(role: string) {
    if (role === activeRole || busy) return;
    setBusy(true);
    try {
      const res = await fetch(apiUrl("/api/switch-role"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      // Máy chủ từ chối (vai trò không thuộc tài khoản, phiên hết hạn) thì
      // đứng yên. Trước đây lỗi bị nuốt rồi vẫn điều hướng, nên người dùng
      // hạ cánh ở trang mới với vai trò cũ và tưởng menu bị hỏng.
      //
      // Báo lỗi ra ngoài thay vì im lặng return — im lặng khiến người dùng
      // thấy "bấm không có phản ứng gì" và không có manh mối gì để báo lại.
      if (!res.ok) {
        setBusy(false);
        toast.error(
          res.status === 401
            ? "Phiên đăng nhập đã hết hạn, hãy tải lại trang"
            : "Không thể chuyển vai trò, thử lại sau",
        );
        return;
      }
    } catch {
      setBusy(false);
      toast.error("Không kết nối được máy chủ, thử lại sau");
      return;
    }

    // Tải lại hẳn trang thay vì điều hướng phía máy khách.
    //
    // Vai trò đang hoạt động nằm trong cookie, và cả header lẫn menu trái đều
    // đọc nó ở phía máy chủ. Điều hướng phía máy khách giữ nguyên layout gốc
    // đã dựng, nên header vẫn là vai trò cũ; tệ hơn, learner và mentor cùng
    // trỏ về /me/dashboard nên `router.push` từ chính trang đó là lệnh rỗng —
    // không có gì dựng lại, và người dùng thấy đúng cái họ vừa bấm để đổi.
    //
    // Đổi vai trò là việc hiếm và có chủ ý; một lần tải lại đổi lấy sự chắc
    // chắn là đáng. Giữ `busy` để nút không bấm lại được trong lúc trang đi.
    window.location.assign(withBasePath(ROLE_DEFAULT_PATH[role] ?? "/me/dashboard"));
  }

  if (variant === "switch") {
    return (
      <div className="flex flex-col gap-1 py-2">
        <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
          Chuyển vai trò
        </p>
        <div className="flex flex-col gap-1">
          {roles.map((role) => {
            const isActive = role === activeRole;
            return (
              <button
                key={role}
                onClick={() => switchTo(role)}
                disabled={busy || isActive}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-all ${
                  isActive
                    ? "bg-[rgb(var(--surface-muted))] font-semibold text-[rgb(var(--text))]"
                    : "text-muted hover:bg-[rgb(var(--surface-muted))] hover:text-[rgb(var(--text))]"
                } disabled:opacity-50`}
              >
                <span
                  className={`h-2 w-2 rounded-full shrink-0 ${isActive ? "bg-brand-500" : "bg-transparent border border-muted"}`}
                />
                {ROLE_LABELS[role] ?? role}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // header variant: compact pill tabs
  return (
    <div
      className={`flex items-center rounded-full border border-token bg-[rgb(var(--surface-muted))] p-0.5 gap-0.5 transition-opacity ${busy ? "opacity-60" : ""}`}
    >
      {roles.map((role) => {
        const isActive = role === activeRole;
        return (
          <button
            key={role}
            onClick={() => switchTo(role)}
            disabled={busy || isActive}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
              isActive
                ? "bg-[rgb(var(--surface))] text-[rgb(var(--text))] shadow-sm"
                : "text-muted hover:text-[rgb(var(--text))]"
            }`}
          >
            {ROLE_LABELS[role] ?? role}
          </button>
        );
      })}
    </div>
  );
}
