"use client";

import { Download } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";

export type ExportKind = "enrollments" | "quiz-gradebook" | "assignment-gradebook";

const LABELS: Record<ExportKind, string> = {
  enrollments: "Tải danh sách học viên",
  "quiz-gradebook": "Tải bảng điểm quiz",
  "assignment-gradebook": "Tải bảng điểm bài tập",
};

/** Nút tải CSV dạy học (danh sách, bảng điểm) đặt ngay tab giảng viên đang đứng. */
export default function ExportButtons({
  courseId,
  kinds,
}: {
  courseId: string;
  kinds: ExportKind[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {kinds.map((k) => (
        <a
          key={k}
          href={apiUrl(`/api/instructor/courses/${courseId}/analytics/exports/${k}`)}
          className="btn-secondary btn-sm"
          download
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
          {LABELS[k]}
        </a>
      ))}
    </div>
  );
}
