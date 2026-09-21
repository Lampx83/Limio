"use client";

import Link from "next/link";
import { CalendarCheck } from "lucide-react";

/**
 * Lối vào "Tổ chức thi" từ một đề.
 *   - Đề đã publish → sang trang chọn hình thức, mang theo đề này để chọn sẵn.
 *   - Đề nháp → đường tới nơi publish, thay vì một nút xám cụt chỉ nói "cần
 *     publish" mà không chỉ chỗ bấm.
 */
export default function OrganizeExamButton({
  examId,
  courseId,
  isDraft,
}: {
  examId: string;
  courseId: string;
  isDraft: boolean;
}) {
  if (!isDraft) {
    return (
      <Link
        href={`/instructor/organize?examId=${examId}`}
        className="inline-flex items-center gap-1.5 rounded bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
      >
        <CalendarCheck className="h-3.5 w-3.5 shrink-0" /> Tổ chức thi
      </Link>
    );
  }

  return (
    <Link
      href={`/instructor/courses/${courseId}/exams/${examId}`}
      title="Đề còn ở nháp — vào trang đề để kiểm tra nội dung và bấm Publish, rồi mới tổ chức thi được."
      className="inline-flex items-center gap-1.5 rounded border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100"
    >
      <CalendarCheck className="h-3.5 w-3.5 shrink-0" /> Publish để tổ chức thi
    </Link>
  );
}
