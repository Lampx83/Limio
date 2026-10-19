import Link from "next/link";
import { BarChart3, BookOpen, Dumbbell, Eye, FileText, Info, Layers, UserCheck, type LucideIcon } from "lucide-react";
import { examTabsFor, type ExamTab } from "@/lib/examTabs";

// A5.3 PR2.9 — Exam editor giờ chỉ phụ trách CONTENT của đề: Tổng quan / Nội dung. Mọi setup logistics (quyền
// truy cập, lịch thi, thí sinh, phòng thi) chuyển sang "Tổ chức thi" (/instructor/exam-rounds/...).
// A6.1 — Vấn đáp AI không có ExamQuestion nên dùng "Tài liệu" thay cho "Nội dung"; "organize" chỉ dành cho oral.
// LANG L4.3 — đề NGOẠI NGỮ (thi thử) có bộ tab riêng: Cấu trúc · Nội dung · Thang điểm · Luyện đề · Xem trước.
// Logic chọn tab ở lib/examTabs.ts (thuần, có test); file này chỉ vẽ.
export type { ExamTab } from "@/lib/examTabs";

const META: Record<ExamTab, { label: string; Icon: LucideIcon }> = {
  overview: { label: "Tổng quan", Icon: Info },
  content: { label: "Nội dung", Icon: BookOpen },
  materials: { label: "Tài liệu", Icon: FileText },
  organize: { label: "Tổ chức thi", Icon: UserCheck },
  structure: { label: "Cấu trúc", Icon: Layers },
  scoring: { label: "Thang điểm", Icon: BarChart3 },
  practice: { label: "Luyện đề", Icon: Dumbbell },
  preview: { label: "Xem trước", Icon: Eye },
};

export default function ExamTabs({
  courseId,
  examId,
  active,
  kind = "written",
  mockMode = false,
  badges,
}: {
  courseId: string;
  examId: string;
  active: ExamTab;
  kind?: "written" | "oral";
  /** LANG L4 — đề ngoại ngữ (thi thử): bộ tab riêng. */
  mockMode?: boolean;
  badges?: Partial<Record<ExamTab, number>>;
}) {
  const tabs = examTabsFor(kind, mockMode);
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
                ? "border-lime-600 text-lime-700 dark:border-lime-400 dark:text-lime-300"
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
