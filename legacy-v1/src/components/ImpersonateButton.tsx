"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ImpersonateButton({
  userId,
  label = "Xem như",
}: {
  userId: number;
  label?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function go() {
    if (!confirm(`Chuyển sang xem dưới danh nghĩa user #${userId}?`)) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_user_id: userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Impersonate thất bại");
        return;
      }
      const role = data.role as string;
      const dest =
        role === "student"
          ? "/student"
          : role === "instructor"
            ? "/instructor"
            : role === "institution_admin"
              ? "/institution-admin"
              : "/";
      router.push(dest);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={go}
      disabled={loading}
      className="text-xs px-2 py-1 rounded border border-amber-400 text-amber-700 dark:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-900/30"
      title="Chuyển sang view của user này"
    >
      {loading ? "..." : `🎭 ${label}`}
    </button>
  );
}
