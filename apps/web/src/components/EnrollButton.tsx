"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "@/lib/toast";
import { formatPrice, isFree } from "@/lib/formatPrice";
import { apiUrl } from "@/lib/apiUrl";
import { enrollErrorMessage } from "@/lib/enrollErrors";
import { accessSummary } from "@/lib/accessSummary";
import { useT, useUiLang } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/dict";

// Mã lỗi → khoá dict (catalog.redeemErr.* / catalog.checkoutErr.*). Mã lạ rơi về câu "thử lại" chung.
const REDEEM_ERROR_CODES = new Set([
  "code_not_found",
  "code_already_used",
  "code_revoked",
  "code_expired",
  "course_not_enrollable",
  "rate_limited",
  "validation_failed",
]);

const CHECKOUT_ERROR_CODES = new Set([
  "stripe_not_configured",
  "access_plan_not_found",
  "course_is_free",
  "vnpay_not_configured",
  "currency_not_supported",
  "course_not_enrollable",
]);

export type PaymentProviderChoice = "stripe" | "vnpay";

export interface AccessPlanOption {
  id: string;
  label: string;
  durationMonths: number | null;
  priceCents: number;
  currency: string;
}

function durationSuffix(months: number | null, t: (key: MessageKey, params?: Record<string, string | number>) => string): string {
  if (months === null) return t("catalog.enroll.lifetime");
  if (months % 12 === 0) {
    const n = months / 12;
    return t(n === 1 ? "catalog.enroll.yearOne" : "catalog.enroll.years", { n });
  }
  return t(months === 1 ? "catalog.enroll.monthOne" : "catalog.enroll.months", { months, n: months });
}

export default function EnrollButton({
  courseId,
  slug,
  alreadyEnrolled,
  priceCents,
  currency = "VND",
  paymentEnabled = false,
  accessPlans = [],
  paymentProviders = [],
  // Chữ trên nút ở nhánh miễn phí. Mặc định "Đăng ký miễn phí" đứng cạnh ô
  // giá/thẻ "Miễn phí" nên hợp ngữ cảnh; nơi nào không có gì để so sánh giá
  // bên cạnh (banner "chưa đăng ký" trên trang khoá) thì truyền nhãn trung
  // tính hơn như "Đăng ký ngay" — nút vẫn làm đúng một việc, chỉ đổi chữ.
  freeLabel,
}: {
  courseId: string;
  slug: string;
  alreadyEnrolled: boolean;
  priceCents?: number | null;
  currency?: string;
  paymentEnabled?: boolean;
  /** Gói bán theo thời hạn (CourseAccessPlan). Rỗng = đường cũ, giá phẳng + mã kích hoạt. */
  accessPlans?: AccessPlanOption[];
  /** Cổng đã cấu hình (lib/paymentProviders). Có "vnpay" thì hiện lựa chọn; không có thì giữ nút thẻ như trước. */
  paymentProviders?: PaymentProviderChoice[];
  freeLabel?: string;
}) {
  const t = useT();
  const lang = useUiLang();
  const [submitting, setSubmitting] = useState(false);
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState(accessPlans[0]?.id ?? "");
  const [checkingOut, setCheckingOut] = useState(false);
  const [showRedeem, setShowRedeem] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  // When payment is globally disabled, treat every course as free for UI purposes.
  const free = !paymentEnabled || (accessPlans.length === 0 && isFree(priceCents));

  if (alreadyEnrolled) {
    return (
      <Link
        href={`/learn/${slug}`}
        className="inline-flex items-center gap-2 rounded-xl bg-success-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:scale-[1.02] hover:bg-success-700"
      >
        {t("catalog.enroll.continue")}
      </Link>
    );
  }

  async function onEnrollFree() {
    setSubmitting(true);
    setEnrollError(null);
    let res: Response;
    try {
      res = await fetch(apiUrl(`/api/courses/${slug}/enroll`), { method: "POST" });
    } catch {
      setEnrollError(enrollErrorMessage("network_error", undefined, lang));
      setSubmitting(false);
      return;
    }
    if (res.status === 401) {
      window.location.href = `/signin?callbackUrl=/catalog/${slug}`;
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      // Lỗi hiện thành banner cố định cạnh nút (toast tự tắt sau 4s nên dễ lỡ).
      setEnrollError(enrollErrorMessage(data?.error, res.status, lang));
      setSubmitting(false);
      return;
    }
    toast.success(t("catalog.enroll.success"), { description: t("catalog.enroll.redirecting") });
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
      toast.error(t("catalog.enroll.redeemFailed"), {
        description: REDEEM_ERROR_CODES.has(data.error)
          ? t(`catalog.redeemErr.${data.error}` as MessageKey)
          : t("catalog.enroll.tryAgain"),
      });
      setRedeeming(false);
      return;
    }
    toast.success(t("catalog.enroll.redeemSuccess"), {
      description: `${accessSummary(data.accessExpiresAt, lang)} ${t("catalog.enroll.redirecting")}`,
    });
    window.location.href = `/learn/${data.courseSlug ?? slug}`;
  }

  async function onCheckout(provider: PaymentProviderChoice = "stripe") {
    if (accessPlans.length > 0 && !selectedPlanId) return;
    setCheckingOut(true);
    const res = await fetch(apiUrl("/api/orders/checkout"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courseId,
        accessPlanId: accessPlans.length > 0 ? selectedPlanId : undefined,
        // Chỉ gửi khi chọn VNPay: đường Stripe giữ nguyên body như trước.
        ...(provider === "vnpay" ? { provider } : {}),
      }),
    });
    if (res.status === 401) {
      window.location.href = `/signin?callbackUrl=/catalog/${slug}`;
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) {
      toast.error(t("catalog.enroll.checkoutFailed"), {
        description: CHECKOUT_ERROR_CODES.has(data.error)
          ? t(`catalog.checkoutErr.${data.error}` as MessageKey)
          : t("catalog.enroll.tryLater"),
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
        <div role="radiogroup" aria-label={t("catalog.enroll.choosePlan")} className="space-y-2">
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
                  <span className="block text-xs text-faint">{t("catalog.enroll.accessFor", { duration: durationSuffix(p.durationMonths, t) })}</span>
                </span>
              </span>
              <span className="font-bold tabular-nums">{formatPrice(p.priceCents, p.currency)}</span>
            </label>
          ))}
        </div>
        {paymentProviders.includes("vnpay") ? (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => void onCheckout("vnpay")}
              disabled={checkingOut || !selectedPlanId}
              className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
            >
              {checkingOut ? t("catalog.enroll.opening") : t("catalog.enroll.payVnpay")}
            </button>
            {paymentProviders.includes("stripe") && (
              <button
                type="button"
                onClick={() => void onCheckout("stripe")}
                disabled={checkingOut || !selectedPlanId}
                className="btn-secondary w-full disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("catalog.enroll.payIntl")}
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void onCheckout()}
            disabled={checkingOut || !selectedPlanId}
            className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
          >
            {checkingOut ? t("catalog.enroll.opening") : t("catalog.enroll.payCard")}
          </button>
        )}
        {!showRedeem ? (
          <button
            type="button"
            onClick={() => setShowRedeem(true)}
            className="text-xs text-muted underline-offset-2 hover:underline"
          >
            {t("catalog.enroll.haveCode")}
          </button>
        ) : (
          <div className="flex flex-wrap gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void onRedeemCode()}
              placeholder={t("catalog.enroll.codePlaceholder")}
              className="input min-w-0 flex-1 font-mono uppercase tracking-wider"
            />
            <button
              type="button"
              onClick={() => void onRedeemCode()}
              disabled={redeeming || !code.trim()}
              className="btn-secondary shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {redeeming ? t("catalog.enroll.activating") : t("catalog.enroll.activate")}
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
          <p className="text-xs font-medium uppercase tracking-wide text-faint">{t("catalog.enroll.tuition")}</p>
          <p className="text-xl font-bold tabular-nums">{formatPrice(priceCents!, currency)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void onRedeemCode()}
            placeholder={t("catalog.enroll.codePlaceholder")}
            className="input min-w-0 flex-1 font-mono uppercase tracking-wider"
          />
          <button
            type="button"
            onClick={() => void onRedeemCode()}
            disabled={redeeming || !code.trim()}
            className="btn-primary shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {redeeming ? t("catalog.enroll.activating") : t("catalog.enroll.activate")}
          </button>
        </div>
        <p className="text-xs text-muted">
          {t("catalog.enroll.noCode")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
    <button
      onClick={() => void onEnrollFree()}
      disabled={submitting}
      className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-brand-700 shadow-sm transition-all hover:scale-[1.02] hover:shadow-lg disabled:opacity-50 disabled:hover:scale-100"
    >
      {submitting ? t("catalog.enroll.enrolling") : (freeLabel ?? t("catalog.enroll.free"))}
    </button>
    {enrollError && (
      <div role="alert" className="banner-danger text-sm">
        {enrollError}
      </div>
    )}
    </div>
  );
}
