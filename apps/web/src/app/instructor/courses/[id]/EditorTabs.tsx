import Link from "next/link";

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

const TABS: Array<{ key: EditorTab; label: string; icon: string }> = [
  { key: "overview", label: "Tổng quan", icon: "ⓘ" },
  { key: "content", label: "Nội dung", icon: "📚" },
  { key: "students", label: "Học viên", icon: "👥" },
  { key: "sections", label: "Lớp học", icon: "🏫" },
  { key: "assignments", label: "Assignment", icon: "📝" },
  { key: "analytics", label: "Phân tích", icon: "📊" },
];

export default function EditorTabs({
  courseId,
  active,
  hiddenTabs = [],
}: {
  courseId: string;
  active: EditorTab;
  hiddenTabs?: EditorTab[];
}) {
  return (
    <nav
      role="tablist"
      aria-label="Course editor tabs"
      className="flex gap-1 overflow-x-auto border-b border-token"
    >
      {TABS.filter((t) => !hiddenTabs.includes(t.key)).map((t) => {
        const isActive = t.key === active;
        return (
          <Link
            key={t.key}
            role="tab"
            aria-selected={isActive}
            href={`/instructor/courses/${courseId}?tab=${t.key}`}
            prefetch={false}
            className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-muted hover:border-token hover:text-default"
            }`}
          >
            <span aria-hidden>{t.icon}</span>
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
