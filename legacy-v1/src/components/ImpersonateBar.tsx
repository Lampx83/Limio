"use client";

import { useRouter } from "next/navigation";

export default function ImpersonateBar({
  asWho,
  originalRole,
}: {
  asWho: string;
  originalRole: string;
}) {
  const router = useRouter();

  async function exit() {
    const res = await fetch("/api/admin/impersonate", { method: "DELETE" });
    if (res.ok) {
      const data = await res.json();
      const role = data.role as string;
      const dest =
        role === "system_admin"
          ? "/admin"
          : role === "institution_admin"
            ? "/institution-admin"
            : role === "instructor"
              ? "/instructor"
              : "/";
      router.push(dest);
      router.refresh();
    }
  }

  return (
    <div className="bg-amber-500 text-white text-xs sm:text-sm px-3 py-2 flex items-center justify-between gap-2 sticky top-0 z-50">
      <span className="truncate">
        🎭 Đang xem dưới danh nghĩa <strong>{asWho}</strong>
      </span>
      <button
        onClick={exit}
        className="bg-white text-amber-700 font-medium rounded px-3 py-1 text-xs shrink-0 hover:bg-amber-50"
      >
        ← Quay lại {originalRole === "system_admin" ? "QT Hệ thống" : "QT Cơ sở"}
      </button>
    </div>
  );
}
