import Link from "next/link";
import {
  Info,
  BookOpen,
  Users,
  School,
  GraduationCap,
  BarChart3,
  Lock,
  type LucideIcon,
} from "lucide-react";

/*
 * prefetch={false} ở mọi link trỏ về chính route này:
 * `/instructor/courses/[id]` là force-dynamic, nên mỗi <Link> mà Next prefetch
 * là một lần render thật trên server. Trang này sinh link cho 5 tab + mỗi bài
 * học một cái, nên chỉ mở trang thôi đã bắn ~16-20 request trong một giây —
 * đo được 16 request đồng thời mất tới 1,9s, trong khi một request đơn lẻ chỉ
 * 150ms. Đợt prefetch đó chiếm event loop của đúng replica đang phục vụ mình,
 * nên cú click ngay sau đó phải xếp hàng. Điều hướng thật đã đủ nhanh để không
 * cần đánh đổi như vậy.
 */

export type EditorTab =
  | "overview"
  | "content"
  | "students"
  | "sections"
  | "assignments"
  | "analytics";

const TABS: Array<{ key: EditorTab; label: string; icon: LucideIcon }> = [
  { key: "overview", label: "Tổng quan", icon: Info },
  { key: "content", label: "Nội dung", icon: BookOpen },
  { key: "students", label: "Học viên", icon: Users },
  { key: "sections", label: "Lớp học", icon: School },
  { key: "assignments", label: "Grade", icon: GraduationCap },
  { key: "analytics", label: "Phân tích", icon: BarChart3 },
];

const LOCKED_TAB_MESSAGE = "Nội dung đang bị khóa, bạn không có quyền chỉnh sửa";

export default function EditorTabs({
  courseId,
  active,
  hiddenTabs = [],
  lockedTabs = [],
}: {
  courseId: string;
  active: EditorTab;
  hiddenTabs?: EditorTab[];
  lockedTabs?: EditorTab[];
}) {
  return (
    <nav
      role="tablist"
      aria-label="Course editor tabs"
      className="flex gap-1 overflow-x-auto border-b border-token"
    >
      {TABS.filter((t) => !hiddenTabs.includes(t.key)).map((t) => {
        const isActive = t.key === active;
        const isLocked = lockedTabs.includes(t.key);
        const Icon = t.icon;

        if (isLocked) {
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={false}
              aria-disabled="true"
              disabled
              title={LOCKED_TAB_MESSAGE}
              className="-mb-px inline-flex shrink-0 cursor-not-allowed items-center gap-2 whitespace-nowrap rounded-t-lg border-b-2 border-transparent px-3.5 py-2 text-sm font-medium text-muted opacity-60"
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span>{t.label}</span>
              <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
            </button>
          );
        }

        return (
          <Link
            key={t.key}
            role="tab"
            aria-selected={isActive}
            href={`/instructor/courses/${courseId}?tab=${t.key}`}
            prefetch={false}
            className={`-mb-px inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-t-lg border-b-2 px-3.5 py-2 text-sm font-medium transition-all duration-150 ${
              isActive
                ? "border-brand-600 bg-[rgb(var(--brand-soft))] font-semibold text-brand-700 shadow-sm"
                : "border-transparent text-muted hover:border-token hover:bg-[rgb(var(--surface-muted))] hover:text-default"
            }`}
          >
            <Icon
              className={`h-4 w-4 shrink-0 transition-colors ${isActive ? "text-brand-600" : ""}`}
              aria-hidden
            />
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
