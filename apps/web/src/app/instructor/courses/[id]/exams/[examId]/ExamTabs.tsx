import Link from "next/link";
import {
  BookOpen,
  ChartBar,
  Info,
  type LucideIcon,
} from "lucide-react";

// A5.3 PR2.9 — Exam editor giờ chỉ phụ trách CONTENT của đề:
//   Tổng quan / Nội dung / Kết quả
// Mọi setup logistics (quyền truy cập, lịch thi, thí sinh, phòng thi)
// chuyển sang "Tổ chức thi" (/instructor/exam-rounds/...).
export type ExamTab = "overview" | "content" | "results";

export const EXAM_TABS: ExamTab[] = ["overview", "content", "results"];

export function parseExamTab(raw: string | string[] | undefined): ExamTab {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return (EXAM_TABS as string[]).includes(v ?? "") ? (v as ExamTab) : "overview";
}

const META: Array<{ key: ExamTab; label: string; Icon: LucideIcon }> = [
  { key: "overview", label: "Tổng quan", Icon: Info },
  { key: "content", label: "Nội dung", Icon: BookOpen },
  { key: "results", label: "Kết quả", Icon: ChartBar },
];

export default function ExamTabs({
  courseId,
  examId,
  active,
  badges,
}: {
  courseId: string;
  examId: string;
  active: ExamTab;
  badges?: Partial<Record<ExamTab, number>>;
}) {
  return (
    <nav
      role="tablist"
      aria-label="Exam editor tabs"
      className="flex gap-1 overflow-x-auto border-b border-token"
    >
      {META.map((t) => {
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
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-muted hover:border-token hover:text-default"
            }`}
          >
            <t.Icon aria-hidden size={16} strokeWidth={1.75} />
            <span>{t.label}</span>
            {badge !== undefined && badge > 0 && (
              <span
                className={`ml-1 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  isActive
                    ? "bg-brand-100 text-brand-700"
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
