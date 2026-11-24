"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

/**
 * Nút "Mua trọn bộ" (docs/tieu-chi/combo-khoa-hoc.md, AC3–AC4): tạo đơn combo qua VNPay rồi chuyển người mua sang
 * cổng thanh toán. Chưa đăng nhập → tới trang đăng nhập rồi quay lại trang combo. Quyền học chỉ do IPN cấp.
 */
export default function BundleBuyButton({
  bundleId,
  slug,
  disabled,
  disabledReason,
}: {
  bundleId: string;
  slug: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buy() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/orders/checkout"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bundleId, provider: "vnpay" }),
      });
      if (res.status === 401) {
        window.location.href = `/signin?callbackUrl=/combo/${slug}`;
        return;
      }
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (res.ok && data?.url) {
        window.location.href = data.url;
        return;
      }
      setError(
        data?.error === "vnpay_not_configured"
          ? "Thanh toán VNPay chưa được bật. Vui lòng liên hệ Limio."
          : data?.error === "bundle_not_purchasable"
            ? "Combo tạm thời chưa mua được. Vui lòng thử lại sau."
            : "Không tạo được thanh toán. Vui lòng thử lại.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        id="bundle-buy"
        onClick={buy}
        disabled={busy || disabled}
        className="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Đang chuyển tới VNPay…" : "Mua trọn bộ"}
      </button>
      {disabled && disabledReason && <p className="mt-2 text-xs text-muted">{disabledReason}</p>}
      {error && (
        <p role="alert" className="mt-2 text-xs text-danger-600">
          {error}
        </p>
      )}
    </div>
  );
}
