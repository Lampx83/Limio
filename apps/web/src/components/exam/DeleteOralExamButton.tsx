"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";

/**
 * Xoá đề vấn đáp. deleteExam (core-lms) tự chặn khi đề đã publish và có lượt
 * thi (exam_has_attempts) — nút này chỉ hiện lỗi ra, không tự bỏ qua guard.
 */
export default function DeleteOralExamButton({
  examId,
  examTitle,
  redirectTo,
}: {
  examId: string;
  examTitle: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    if (!confirm(`Xoá đề "${examTitle}"? Không thể hoàn tác.`)) return;
    setBusy(true);
    setError(null);
    const res = await fetch(apiUrl(`/api/exams/${examId}`), { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(
        d?.error === "exam_has_attempts"
          ? "Đề đã publish và có lượt thi — không xoá được."
          : typeof d?.error === "string"
            ? d.error
            : "Không xoá được.",
      );
      return;
    }
    if (redirectTo) router.push(redirectTo);
    else router.refresh();
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
