import Link from "next/link";
import { SECTION_TABS, type SectionTabId } from "@/lib/sectionTabs";

/**
 * Thanh tab của trang lớp (chỉ khi khoá dùng tính năng trung tâm): "Lịch dạy" và "Học viên". Là liên kết thường
 * (`?tab=`), nên mỗi tab có đường dẫn riêng, bấm "Quay lại" và chia sẻ link đều đúng tab.
 */
export default function SectionTabs({ courseId, sectionId, active }: { courseId: string; sectionId: string; active: SectionTabId }) {
  return (
    <nav className="mt-4 flex gap-1 border-b border-token" aria-label="Các phần của lớp">
      {SECTION_TABS.map((t) => {
        const on = t.id === active;
        return (
          <Link
            key={t.id}
            href={`/instructor/courses/${courseId}/sections/${sectionId}?tab=${t.id}`}
            prefetch={false}
            aria-current={on ? "page" : undefined}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
              on ? "border-brand-600 text-brand-700" : "border-transparent text-muted hover:text-[rgb(var(--text))]"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
