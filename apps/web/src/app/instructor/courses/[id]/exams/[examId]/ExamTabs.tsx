import Link from "next/link";
import { BookOpen, FileText, Info, type LucideIcon } from "lucide-react";

// A5.3 PR2.9 — Exam editor giờ chỉ phụ trách CONTENT của đề: Tổng quan / Nội
// dung. Mọi setup logistics (quyền truy cập, lịch thi, thí sinh, phòng thi)
// chuyển sang "Tổ chức thi" (/instructor/exam-rounds/...).
//
// Tab "Blueprint" cũ (2026-09) đã gộp vào modal "Từ ngân hàng" trong tab Nội
// dung — thành lựa chọn nâng cao thứ 3 ("Thiết kế đề theo ma trận đề thi"),
// không còn là tab riêng để đỡ một khái niệm mọc lên không giải thích.
//
// A6.1 — Vấn đáp AI không có ExamQuestion nên không dùng tab "Nội dung"; thay
// bằng "Tài liệu" (materials) để GV nộp đề cương/danh sách chủ đề cho AI.
// Một exam chỉ hiện MỘT trong hai tab content/materials tuỳ exam.kind.
export type ExamTab = "overview" | "content" | "materials";

// Không còn tab "Kết quả": kết quả nói về AI ĐÃ LÀM, mà "ai" thuộc buổi thi
// chứ không thuộc gói đề. Xem ở Tổ chức thi → từng lần thi.
export const EXAM_TABS: ExamTab[] = ["overview", "content", "materials"];

export function parseExamTab(raw: string | string[] | undefined): ExamTab {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return (EXAM_TABS as string[]).includes(v ?? "") ? (v as ExamTab) : "overview";
}

const META: Record<ExamTab, { label: string; Icon: LucideIcon }> = {
  overview: { label: "Tổng quan", Icon: Info },
  content: { label: "Nội dung", Icon: BookOpen },
  materials: { label: "Tài liệu", Icon: FileText },
};

export default function ExamTabs({
  courseId,
  examId,
  active,
  kind = "written",
  badges,
}: {
  courseId: string;
  examId: string;
  active: ExamTab;
  kind?: "written" | "oral";
  badges?: Partial<Record<ExamTab, number>>;
}) {
  const tabs: ExamTab[] =
    kind === "oral" ? ["overview", "materials"] : ["overview", "content"];
  return (
    <nav
      role="tablist"
      aria-label="Exam editor tabs"
      className="flex gap-1 overflow-x-auto border-b border-token"
    >
      {tabs.map((key) => {
        const t = { key, ...META[key] };
        const isActive = t.key === active;
        const badge = badges?.[t.key];
        return (
          <Link
            key={t.key}
            role="tab"
            aria-selected={isActive}
            href={`/instructor/courses/${courseId}/exams/${examId}?tab=${t.key}`}
            scroll={false}
            className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? "border-amber-600 text-amber-700"
                : "border-transparent text-muted hover:border-token hover:text-default"
            }`}
            prefetch={false}
          >
            <t.Icon aria-hidden size={16} strokeWidth={1.75} />
            <span>{t.label}</span>
            {badge !== undefined && badge > 0 && (
              <span
                className={`ml-1 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  isActive
                    ? "bg-amber-100 text-amber-700"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
