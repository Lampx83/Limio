import Link from "next/link";

export type EditorTab = "overview" | "content" | "students" | "sections" | "analytics";

const TABS: Array<{ key: EditorTab; label: string; icon: string }> = [
  { key: "overview", label: "Tổng quan", icon: "ⓘ" },
  { key: "content", label: "Nội dung", icon: "📚" },
  { key: "students", label: "Học viên", icon: "👥" },
  { key: "sections", label: "Lớp học", icon: "🏫" },
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
