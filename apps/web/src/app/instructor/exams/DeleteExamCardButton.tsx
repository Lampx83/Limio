"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";

const ERRORS: Record<string, string> = {
  exam_has_attempts: "Đề đã có lượt thi nên không xoá được.",
  forbidden: "Bạn không có quyền xoá đề này.",
  exam_not_found: "Đề không còn tồn tại.",
};

/**
 * Nút xoá trên thẻ đề ở trang Đề thi.
 *
 * Đề đã có lượt thi KHÔNG xoá được (xoá Exam cascade sạch bài làm và event) —
 * nút vẫn hiện nhưng bị khoá kèm lý do, để giáo viên không tưởng là thiếu chức
 * năng. Server vẫn là nơi chặn thật; cờ `attempts` chỉ để khỏi bấm vô ích.
 */
export default function DeleteExamCardButton({
  examId,
  title,
  attempts,
  className,
}: {
  examId: string;
  title: string;
  attempts: number;
  className: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const blocked = attempts > 0;

  async function remove() {
    if (
      !window.confirm(
        `Xoá đề “${title}”? Câu hỏi trong đề sẽ mất và không hoàn tác được.`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/exams/${examId}`), { method: "DELETE" });
      if (res.ok) {
        router.refresh();
        return;
      }
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(
        (data?.error && ERRORS[data.error]) || "Không xoá được đề. Vui lòng thử lại.",
      );
    } catch {
      setError("Mất kết nối khi xoá đề. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={remove}
        disabled={busy || blocked}
        className={`${className} !text-danger-700 hover:!bg-danger-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:!bg-transparent`}
        title={
          blocked
            ? `Đề đã có ${attempts} lượt thi nên không xoá được`
            : "Xoá đề này"
        }
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
        {busy ? "Đang xoá…" : "Xoá"}
      </button>
      {error && (
        <span role="alert" className="text-xs text-danger-700">
          {error}
        </span>
      )}
    </>
  );
}
