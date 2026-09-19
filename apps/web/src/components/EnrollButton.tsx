"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "@/lib/toast";
import { formatPrice, isFree } from "@/lib/formatPrice";
import { apiUrl } from "@/lib/apiUrl";

const REDEEM_ERROR_LABEL: Record<string, string> = {
  code_not_found: "Không tìm thấy mã này. Kiểm tra lại chữ/số đã gõ.",
  code_already_used: "Mã này đã được dùng rồi.",
  code_revoked: "Mã này đã bị thu hồi.",
  course_not_enrollable: "Khoá học hiện chưa mở đăng ký.",
  rate_limited: "Bạn thử quá nhiều lần, vui lòng đợi một chút rồi thử lại.",
  validation_failed: "Vui lòng nhập mã.",
};

const CHECKOUT_ERROR_LABEL: Record<string, string> = {
  stripe_not_configured: "Thanh toán thẻ hiện chưa khả dụng. Vui lòng dùng mã kích hoạt.",
  access_plan_not_found: "Gói này không còn bán. Vui lòng tải lại trang.",
  course_is_free: "Khoá học này miễn phí.",
};

export interface AccessPlanOption {
  id: string;
  label: string;
  durationMonths: number | null;
  priceCents: number;
  currency: string;
}

function durationSuffix(months: number | null): string {
  if (months === null) return "vĩnh viễn";
  if (months % 12 === 0) return `${months / 12} năm`;
  return `${months} tháng`;
}

export default function EnrollButton({
  courseId,
  slug,
  alreadyEnrolled,
  priceCents,
  currency = "VND",
  paymentEnabled = false,
  accessPlans = [],
  // Chữ trên nút ở nhánh miễn phí. Mặc định "Đăng ký miễn phí" đứng cạnh ô
  // giá/thẻ "Miễn phí" nên hợp ngữ cảnh; nơi nào không có gì để so sánh giá
  // bên cạnh (banner "chưa đăng ký" trên trang khoá) thì truyền nhãn trung
  // tính hơn như "Đăng ký ngay" — nút vẫn làm đúng một việc, chỉ đổi chữ.
  freeLabel = "Đăng ký miễn phí",
}: {
  courseId: string;
  slug: string;
  alreadyEnrolled: boolean;
  priceCents?: number | null;
  currency?: string;
  paymentEnabled?: boolean;
  /** Gói bán theo thời hạn (CourseAccessPlan). Rỗng = đường cũ, giá phẳng + mã kích hoạt. */
  accessPlans?: AccessPlanOption[];
  freeLabel?: string;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState(accessPlans[0]?.id ?? "");
  const [checkingOut, setCheckingOut] = useState(false);
  const [showRedeem, setShowRedeem] = useState(false);
  // When payment is globally disabled, treat every course as free for UI purposes.
  const free = !paymentEnabled || (accessPlans.length === 0 && isFree(priceCents));

  if (alreadyEnrolled) {
    return (
      <Link
        href={`/learn/${slug}`}
        className="inline-flex items-center gap-2 rounded-xl bg-success-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:scale-[1.02] hover:bg-success-700"
      >
        Tiếp tục học
      </Link>
    );
  }

  async function onEnrollFree() {
    setSubmitting(true);
    const res = await fetch(apiUrl(`/api/courses/${slug}/enroll`), { method: "POST" });
    if (res.status === 401) {
      window.location.href = `/signin?callbackUrl=/catalog/${slug}`;
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error("Đăng ký thất bại", {
        description: data.error ?? "Vui lòng thử lại sau.",
      });
      setSubmitting(false);
      return;
    }
    toast.success("Đăng ký thành công", { description: "Đang chuyển vào khóa…" });
    window.location.href = `/learn/${slug}`;
  }

  // Khoá có phí: hệ thống không tự thu tiền (không cổng thanh toán). Học viên
  // trả tiền cho giảng viên ngoài hệ thống rồi nhận một mã kích hoạt — nhập ở
  // đây là ghi danh ngay, không cần ai duyệt lại lần hai.
  async function onRedeemCode() {
    if (!code.trim()) return;
    setRedeeming(true);
    const res = await fetch(apiUrl("/api/redeem-code"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (res.status === 401) {
      window.location.href = `/signin?callbackUrl=/catalog/${slug}`;
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error("Kích hoạt thất bại", {
        description: REDEEM_ERROR_LABEL[data.error] ?? "Vui lòng thử lại.",
      });
      setRedeeming(false);
      return;
    }
    toast.success("Kích hoạt thành công", { description: "Đang chuyển vào khóa…" });
    window.location.href = `/learn/${data.courseSlug ?? slug}`;
  }

  async function onCheckout() {
    if (accessPlans.length > 0 && !selectedPlanId) return;
    setCheckingOut(true);
    const res = await fetch(apiUrl("/api/orders/checkout"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courseId,
        accessPlanId: accessPlans.length > 0 ? selectedPlanId : undefined,
      }),
    });
    if (res.status === 401) {
      window.location.href = `/signin?callbackUrl=/catalog/${slug}`;
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) {
      toast.error("Không mở được trang thanh toán", {
        description: CHECKOUT_ERROR_LABEL[data.error] ?? "Vui lòng thử lại sau.",
      });
      setCheckingOut(false);
      return;
    }
    window.location.href = data.url;
  }

  // Có gói bán theo thời hạn (CourseAccessPlan) — kênh chính là thanh toán
  // thẻ qua Stripe. Mã kích hoạt vẫn còn (đóng gói lại, thu gọn) cho học viên
  // đã trả tiền ngoài hệ thống theo kênh cũ.
  if (!free && accessPlans.length > 0) {
    const selected = accessPlans.find((p) => p.id === selectedPlanId) ?? accessPlans[0];
    return (
      <div className="space-y-3">
        <div role="radiogroup" aria-label="Chọn gói truy cập" className="space-y-2">
          {accessPlans.map((p) => (
            <label
              key={p.id}
              className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 transition-colors ${
                p.id === selected?.id
                  ? "border-brand-500 bg-brand-50 dark:bg-brand-950/30"
                  : "border-token hover:bg-base-50"
              }`}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="access-plan"
                  checked={p.id === selected?.id}
                  onChange={() => setSelectedPlanId(p.id)}
                  className="accent-brand-600"
                />
                <span>
                  <span className="block font-medium">{p.label}</span>
                  <span className="block text-xs text-faint">Truy cập {durationSuffix(p.durationMonths)}</span>
                </span>
              </span>
              <span className="font-bold tabular-nums">{formatPrice(p.priceCents, p.currency)}</span>
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void onCheckout()}
          disabled={checkingOut || !selectedPlanId}
          className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
        >
          {checkingOut ? "Đang mở trang thanh toán…" : "Thanh toán qua thẻ"}
        </button>
        {!showRedeem ? (
          <button
            type="button"
            onClick={() => setShowRedeem(true)}
            className="text-xs text-muted underline-offset-2 hover:underline"
          >
            Đã có mã kích hoạt?
          </button>
        ) : (
          <div className="flex flex-wrap gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void onRedeemCode()}
              placeholder="Nhập mã kích hoạt"
              className="input min-w-0 flex-1 font-mono uppercase tracking-wider"
            />
            <button
              type="button"
              onClick={() => void onRedeemCode()}
              disabled={redeeming || !code.trim()}
              className="btn-secondary shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {redeeming ? "Đang kích hoạt…" : "Kích hoạt"}
            </button>
          </div>
        )}
      </div>
    );
  }

  if (!free) {
    return (
      <div className="space-y-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-faint">Học phí</p>
          <p className="text-xl font-bold tabular-nums">{formatPrice(priceCents!, currency)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void onRedeemCode()}
            placeholder="Nhập mã kích hoạt"
            className="input min-w-0 flex-1 font-mono uppercase tracking-wider"
          />
          <button
            type="button"
            onClick={() => void onRedeemCode()}
            disabled={redeeming || !code.trim()}
            className="btn-primary shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {redeeming ? "Đang kích hoạt…" : "Kích hoạt"}
          </button>
        </div>
        <p className="text-xs text-muted">
          Chưa có mã? Liên hệ ngay với chúng tôi để nhận mã kích hoạt.
        </p>
      </div>
    );
  }

  return (
    <button
      onClick={() => void onEnrollFree()}
      disabled={submitting}
      className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-brand-700 shadow-sm transition-all hover:scale-[1.02] hover:shadow-lg disabled:opacity-50 disabled:hover:scale-100"
    >
      {submitting ? "Đang đăng ký…" : freeLabel}
    </button>
  );
}
