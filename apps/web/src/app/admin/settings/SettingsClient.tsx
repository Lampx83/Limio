"use client";

import { useState, useTransition } from "react";
import { toast } from "@/lib/toast";

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div className="flex-1">
        <p className="text-sm font-semibold">{label}</p>
        <p className="mt-0.5 text-xs text-muted">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
          checked ? "bg-brand-600" : "bg-[rgb(var(--surface-muted))]"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

export default function SettingsClient({
  initialPaymentEnabled,
}: {
  initialPaymentEnabled: boolean;
}) {
  const [paymentEnabled, setPaymentEnabled] = useState(initialPaymentEnabled);
  const [pending, startTransition] = useTransition();

  async function togglePayment(val: boolean) {
    setPaymentEnabled(val);
    startTransition(async () => {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ "payment.enabled": val ? "true" : "false" }),
      });
      if (!res.ok) {
        setPaymentEnabled(!val);
        toast.error("Cập nhật thất bại", { description: "Vui lòng thử lại." });
      } else {
        toast.success(
          val ? "Đã bật hệ thống thanh toán" : "Đã tắt hệ thống thanh toán",
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Payment section */}
      <section className="card">
        <header className="border-b border-token pb-4">
          <h2 className="text-base font-semibold">Thanh toán & Định giá</h2>
          <p className="mt-1 text-xs text-muted">
            Kiểm soát luồng thanh toán trên toàn hệ thống. Khi tắt, tất cả khoá học đều
            đăng ký miễn phí kể cả có gắn giá — dùng cho giai đoạn build nội dung.
          </p>
        </header>

        <div className="divide-y divide-token">
          <ToggleRow
            label="Bật hệ thống thanh toán"
            description={
              paymentEnabled
                ? "Đang bật — khoá học có phí yêu cầu thanh toán trước khi enroll. Giá hiển thị trên catalog."
                : "Đang tắt — tất cả khoá học enroll miễn phí. Giá không hiển thị trên catalog."
            }
            checked={paymentEnabled}
            onChange={togglePayment}
            disabled={pending}
          />
        </div>

        {paymentEnabled && (
          <div className="mt-4 rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-xs text-warning-800">
            <strong>Gateway chưa tích hợp.</strong> Khoá học có phí sẽ hiện nút "Mua khoá học"
            nhưng thanh toán thực tế chưa hoạt động. Cần cấu hình Stripe/VNPay trước khi thu tiền thật.
          </div>
        )}
      </section>
    </div>
  );
}
