"use client";

import { useState } from "react";
import { toast } from "@/lib/toast";
import { formatPrice, isFree } from "@/lib/formatPrice";
import { apiUrl } from "@/lib/apiUrl";

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

  async function onClick() {
    if (!free) {
      // Payment not yet implemented — inform user and stop.
      toast.error("Chưa hỗ trợ thanh toán online", {
        description: "Vui lòng liên hệ giảng viên để được cấp quyền truy cập.",
      });
      return;
    }

    setSubmitting(true);
    const res = await fetch(apiUrl(`/api/courses/${slug}/enroll`), { method: "POST" });
    if (res.status === 401) {
      window.location.href = `/signin?callbackUrl=/catalog/${slug}`;
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.error === "payment_required") {
        toast.error("Khoá học có phí", {
          description: "Vui lòng liên hệ giảng viên để được cấp quyền truy cập.",
        });
      } else {
        toast.error("Đăng ký thất bại", {
          description: data.error ?? "Vui lòng thử lại sau.",
        });
      }
      setSubmitting(false);
      return;
    }
    toast.success("Đăng ký thành công", { description: "Đang chuyển vào khóa…" });
    window.location.href = `/learn/${slug}`;
  }

  if (!free) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur">
          <p className="text-xs font-medium uppercase tracking-wide opacity-70">Học phí</p>
          <p className="text-xl font-bold tabular-nums">
            {formatPrice(priceCents!, currency)}
          </p>
        </div>
        <button
          onClick={onClick}
          className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-brand-700 shadow-sm transition-all hover:scale-[1.02] hover:shadow-lg"
        >
          Mua khoá học
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={submitting}
      className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-brand-700 shadow-sm transition-all hover:scale-[1.02] hover:shadow-lg disabled:opacity-50 disabled:hover:scale-100"
    >
      {submitting ? "Đang đăng ký…" : "Đăng ký miễn phí"}
    </button>
  );
}
