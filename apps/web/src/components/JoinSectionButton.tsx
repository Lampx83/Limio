"use client";

import { useState } from "react";
import { toast } from "@/lib/toast";
import { apiUrl } from "@/lib/apiUrl";
import { enrollErrorMessage } from "@/lib/enrollErrors";

export default function JoinSectionButton({
  code,
  isLoggedIn,
  /** Đã ghi danh khoá này rồi — bấm nút là chuyển lớp, không phải ghi danh. */
  mode = "join",
}: {
  code: string;
  isLoggedIn: boolean;
  mode?: "join" | "move";
}) {
  const [submitting, setSubmitting] = useState(false);

  async function onClick() {
    if (!isLoggedIn) {
      window.location.href = `/signin?callbackUrl=/enroll/${code}`;
      return;
    }

    setSubmitting(true);
    const res = await fetch(apiUrl(`/api/enroll-code/${code}`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ move: mode === "move" }),
    });
    if (res.status === 401) {
      window.location.href = `/signin?callbackUrl=/enroll/${code}`;
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (data.error === "payment_required") {
        toast.error("Khoá học có phí", {
          description: "Vui lòng liên hệ giảng viên để được cấp quyền truy cập.",
        });
      } else if (data.error === "invalid_invite_code") {
        toast.error("Link không còn hiệu lực", {
          description: "Liên hệ giảng viên để lấy link mới.",
        });
      } else {
        toast.error("Tham gia thất bại", {
          description: enrollErrorMessage(data.error, res.status),
        });
      }
      setSubmitting(false);
      return;
    }
    toast.success(mode === "move" ? "Đã chuyển lớp" : "Tham gia thành công", {
      description: "Đang chuyển vào khóa…",
    });
    window.location.href = `/learn/${data.courseSlug}`;
  }

  return (
    <button
      onClick={onClick}
      disabled={submitting}
      className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-brand-700 shadow-sm transition-all hover:scale-[1.02] hover:shadow-lg disabled:opacity-50 disabled:hover:scale-100"
    >
      {submitting
        ? mode === "move"
          ? "Đang chuyển…"
          : "Đang tham gia…"
        : mode === "move"
          ? "Chuyển sang lớp này"
          : "Tham gia lớp học"}
    </button>
  );
}
