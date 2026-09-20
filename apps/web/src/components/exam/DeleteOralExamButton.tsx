"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";

/**
 * Xoá đề vấn đáp. Khác đề viết — deleteExam (core-lms) KHÔNG chặn khi đề
 * vấn đáp đã publish và có lượt thi (đặc thù riêng cho kind=oral), chỉ cần
 * người dùng xác nhận lại ở đây; xoá sẽ cuốn theo toàn bộ hội thoại/điểm AI
 * đã chấm của các lượt đó, không thể hoàn tác.
 */
export default function DeleteOralExamButton({
  examId,
  examTitle,
  redirectTo,
  variant = "default",
}: {
  examId: string;
  examTitle: string;
  redirectTo?: string;
  /** "icon": nút thùng rác gọn, hợp với thẻ danh sách. */
  variant?: "default" | "icon";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    if (
      !confirm(
        `Xoá đề "${examTitle}"? Nếu đã có sinh viên vào thi, toàn bộ hội thoại và điểm đã chấm của họ cũng bị xoá theo. Không thể hoàn tác.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(apiUrl(`/api/exams/${examId}`), { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(typeof d?.error === "string" ? d.error : "Không xoá được.");
      return;
    }
    if (redirectTo) router.push(redirectTo);
    else router.refresh();
  }

  if (variant === "icon") {
    return (
      <span className="inline-flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          title="Xoá đề"
          aria-label={`Xoá đề ${examTitle}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
        {error && <span className="text-caption text-red-700">{error}</span>}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onDelete}
        disabled={busy}
        className="inline-flex items-center gap-1 rounded border border-red-200 px-3 py-1 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" />
        {busy ? "Đang xoá…" : "Xoá"}
      </button>
      {error && <span className="text-caption text-red-700">{error}</span>}
    </span>
  );
}
