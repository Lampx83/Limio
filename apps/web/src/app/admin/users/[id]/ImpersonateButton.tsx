"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

export default function ImpersonateButton({
  userId,
  userName,
}: {
  userId: string;
  userName: string;
}) {
  const [busy, setBusy] = useState(false);

  async function start() {
    if (
      !confirm(
        `Chuyển sang xem ứng dụng dưới vai trò "${userName}"? Mọi hành động vẫn được audit log dưới tên admin của bạn.`,
      )
    ) {
      return;
    }
    setBusy(true);
    const res = await fetch(apiUrl("/api/admin/impersonate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetUserId: userId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(`Lỗi: ${body.error ?? res.status}`);
      setBusy(false);
      return;
    }
    window.location.href = "/";
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={busy}
      className="btn-secondary btn-sm"
      title="Read-only — mọi write vẫn được log dưới tên admin"
    >
      {busy ? "…" : "Xem dưới vai trò này"}
    </button>
  );
}
