"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import BankTransferPanel, { type BankTransferInfo } from "@/components/BankTransferPanel";

/**
 * Nút "Mua trọn bộ" (docs/tieu-chi/combo-khoa-hoc.md, AC3–AC4): tạo đơn combo qua VNPay rồi chuyển người mua sang
 * cổng thanh toán, hoặc qua chuyển khoản VietQR (docs/tieu-chi/thanh-toan-sepay.md) rồi chờ tiền về. Chưa đăng nhập → tới trang đăng nhập rồi quay lại trang combo. Quyền học chỉ do IPN cấp.
 */
export default function BundleBuyButton({
  bundleId,
  slug,
  disabled,
  disabledReason,
  providers,
}: {
  bundleId: string;
  slug: string;
  disabled?: boolean;
  disabledReason?: string;
  /** Cổng đã cấu hình dùng được cho combo (không có Stripe). */
  providers: Array<"vnpay" | "sepay">;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bank, setBank] = useState<BankTransferInfo | null>(null);

  async function buy(provider: "vnpay" | "sepay") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/orders/checkout"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bundleId, provider }),
      });
      if (res.status === 401) {
        window.location.href = `/signin?callbackUrl=/combo/${slug}`;
        return;
      }
      const data = (await res.json().catch(() => null)) as { url?: string; sepay?: BankTransferInfo; error?: string } | null;
      if (res.ok && provider === "sepay" && data?.sepay) {
        setBank(data.sepay);
        return;
      }
      if (res.ok && data?.url) {
        window.location.href = data.url;
        return;
      }
      setError(
        data?.error === "vnpay_not_configured" || data?.error === "sepay_not_configured"
          ? "Cổng thanh toán chưa được bật. Vui lòng liên hệ Limio."
          : data?.error === "bundle_not_purchasable"
            ? "Combo tạm thời chưa mua được. Vui lòng thử lại sau."
            : "Không tạo được thanh toán. Vui lòng thử lại.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (bank) return <BankTransferPanel info={bank} fallbackRedirect="/me?paid=1" onClose={() => setBank(null)} />;

  return (
    <div className="space-y-2">
      {providers.includes("vnpay") && (
        <button
          type="button"
          id="bundle-buy"
          onClick={() => void buy("vnpay")}
          disabled={busy || disabled}
          className="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Đang chuyển tới VNPay…" : "Mua trọn bộ"}
        </button>
      )}
      {providers.includes("sepay") && (
        <button
          type="button"
          id="bundle-buy-bank"
          onClick={() => void buy("sepay")}
          disabled={busy || disabled}
          className={`btn ${providers.includes("vnpay") ? "btn-secondary" : "btn-primary"} w-full disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {busy ? "Đang tạo mã chuyển khoản…" : providers.includes("vnpay") ? "Chuyển khoản VietQR" : "Mua trọn bộ (chuyển khoản VietQR)"}
        </button>
      )}
      {disabled && disabledReason && <p className="mt-2 text-xs text-muted">{disabledReason}</p>}
      {error && (
        <p role="alert" className="mt-2 text-xs text-danger-600">
          {error}
        </p>
      )}
    </div>
  );
}
