"use client";

import { useState } from "react";
import { toast } from "@/lib/toast";

export default function EnrollButton({ slug, alreadyEnrolled }: { slug: string; alreadyEnrolled: boolean }) {
  const [submitting, setSubmitting] = useState(false);

  if (alreadyEnrolled) {
    return (
      <a
        href={`/learn/${slug}`}
        className="inline-flex items-center gap-2 rounded-xl bg-success-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:scale-[1.02] hover:bg-success-700"
      >
        ▶ Tiếp tục học
      </a>
    );
  }

  async function onClick() {
    setSubmitting(true);
    const res = await fetch(`/api/courses/${slug}/enroll`, { method: "POST" });
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
    toast.success("Đăng ký thành công", { description: "Đang chuyển vào khóa..." });
    window.location.href = `/learn/${slug}`;
  }

  return (
    <button
      onClick={onClick}
      disabled={submitting}
      className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-brand-700 shadow-sm transition-all hover:scale-[1.02] hover:shadow-lg disabled:opacity-50 disabled:hover:scale-100"
    >
      {submitting ? "Đang đăng ký..." : "🚀 Đăng ký miễn phí"}
    </button>
  );
}
