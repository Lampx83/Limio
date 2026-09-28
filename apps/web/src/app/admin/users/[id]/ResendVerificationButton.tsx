"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

export default function ResendVerificationButton({
  userId,
  compact = false,
}: {
  userId: string;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function resend() {
    setBusy(true);
    const res = await fetch(apiUrl(`/api/admin/users/${userId}/resend-verification`), {
      method: "POST",
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(`Không gửi được: ${body.error ?? res.status}`);
      return;
    }
    setSent(true);
    setTimeout(() => setSent(false), 4000);
  }

  return (
    <button
      type="button"
      onClick={resend}
      disabled={busy || sent}
      className="btn-secondary btn-sm whitespace-nowrap"
      title="Gửi lại email xác thực (link mới, link cũ sẽ hết hiệu lực)"
    >
      {sent ? "Đã gửi ✓" : busy ? "…" : compact ? "Xác thực" : "Gửi lại email xác thực"}
    </button>
  );
}
