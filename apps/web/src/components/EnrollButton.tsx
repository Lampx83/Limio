"use client";

import { useState } from "react";
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

export default function EnrollButton({
  slug,
  alreadyEnrolled,
  priceCents,
  currency = "VND",
  paymentEnabled = false,
}: {
  slug: string;
  alreadyEnrolled: boolean;
  priceCents?: number | null;
  currency?: string;
  paymentEnabled?: boolean;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  // When payment is globally disabled, treat every course as free for UI purposes.
  const free = !paymentEnabled || isFree(priceCents);

  if (alreadyEnrolled) {
    return (
      <a
        href={`/learn/${slug}`}
        className="inline-flex items-center gap-2 rounded-xl bg-success-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:scale-[1.02] hover:bg-success-700"
      >
        Tiếp tục học
      </a>
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
          Chưa có mã? Thanh toán với giảng viên để nhận mã kích hoạt.
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
      {submitting ? "Đang đăng ký…" : "Đăng ký miễn phí"}
    </button>
  );
}
