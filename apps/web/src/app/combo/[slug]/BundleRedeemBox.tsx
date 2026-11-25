"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

const MESSAGES: Record<string, string> = {
  code_not_found: "Không tìm thấy mã này. Kiểm tra lại từng ký tự.",
  code_already_used: "Mã này đã được dùng.",
  code_revoked: "Mã này đã bị thu hồi.",
  code_expired: "Mã đã hết hạn kích hoạt.",
  course_not_enrollable: "Combo tạm thời chưa kích hoạt được. Vui lòng thử lại sau.",
  rate_limited: "Bạn thử quá nhiều lần. Vui lòng đợi vài phút rồi thử lại.",
};

/** Ô "Tôi có mã" của combo (docs/tieu-chi/combo-khoa-hoc.md, AC8): đổi mã combo lấy quyền vào cả bộ. */
export default function BundleRedeemBox({ slug, returnPath }: { slug: string; returnPath?: string }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function redeem() {
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/redeem-code"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (res.status === 401) {
        window.location.href = `/signin?callbackUrl=${returnPath ?? `/combo/${slug}`}`;
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string; courseSlug?: string };
      if (!res.ok) {
        setError(MESSAGES[data.error ?? ""] ?? "Không kích hoạt được. Vui lòng thử lại.");
        return;
      }
      window.location.href = `/learn/${data.courseSlug ?? ""}`;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2" data-testid="bundle-redeem">
      <label htmlFor="bundle-code" className="text-xs font-medium uppercase tracking-wide text-faint">
        Tôi có mã kích hoạt
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id="bundle-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void redeem()}
          placeholder="XXXX-XXXX-XXXX"
          autoComplete="off"
          className="input min-w-0 flex-1 font-mono uppercase tracking-wider"
        />
        <button
          type="button"
          onClick={() => void redeem()}
          disabled={busy || !code.trim()}
          className="btn-primary shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Đang kích hoạt…" : "Kích hoạt"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-danger-600">
          {error}
        </p>
      )}
    </div>
  );
}
