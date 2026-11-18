"use client";

import { useEffect, useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { RAIL_SECTIONS_TOGGLE_EVENT, SECTIONS_COLLAPSED_KEY } from "@/lib/railSections";
import { useLessonSections } from "./useLessonSections";

/**
 * Mục lục phần của bài đang xem, nằm ngay dưới bài đó trong thanh bài bên trái (docs/tieu-chi/limio-language-ux-p1-ly-thuyet.md, mục F): các mục có số
 * (01 Tình huống, 02 Hội thoại…) đọc thẳng từ tiêu đề mục `.hsk-sh` của nội dung bài; mục đang đọc tô đậm khi cuộn, bấm thì cuộn tới mục.
 * Bấm vào dòng bài hiện tại (CurrentLessonLink) hoặc mũi tên ở góc phải dòng đó (nút đặt tuyệt đối theo `<li>` cha của thanh bài, nên không lồng nút trong liên kết) thì thu gọn / mở danh sách.
 * Bài không có mục có số (khoá khác) thì không hiện gì. Chỉ hiện từ `lg` (dưới `lg` thanh bài nằm trong thanh điều hướng một dòng).
 */
export default function LessonSectionsNav() {
  const t = useT();
  const { secs, cur } = useLessonSections();
  const listId = useId();
  // Khởi đầu luôn là "mở" để khớp bản dựng ở máy chủ; đọc giá trị đã nhớ sau khi vào trang.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem(SECTIONS_COLLAPSED_KEY) === "1") setCollapsed(true);
    } catch {}
  }, []);
  const toggle = () => {
    setCollapsed((v) => {
      try {
        localStorage.setItem(SECTIONS_COLLAPSED_KEY, v ? "0" : "1");
      } catch {}
      return !v;
    });
  };
  // Bấm vào dòng bài hiện tại (CurrentLessonLink) cũng thu gọn/mở.
  useEffect(() => {
    window.addEventListener(RAIL_SECTIONS_TOGGLE_EVENT, toggle);
    return () => window.removeEventListener(RAIL_SECTIONS_TOGGLE_EVENT, toggle);
  }, []);

  if (secs.length === 0) return null;
  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        aria-controls={listId}
        aria-label={collapsed ? t("reader.nav.sectionsExpand") : t("reader.nav.sectionsCollapse")}
        title={collapsed ? t("reader.nav.sectionsExpand") : t("reader.nav.sectionsCollapse")}
        data-testid="lesson-sections-toggle"
        className="absolute right-1.5 top-2 hidden h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-black/5 hover:text-[rgb(var(--text))] lg:flex"
      >
        <ChevronDown size={18} aria-hidden className={`transition-transform ${collapsed ? "-rotate-90" : ""}`} />
      </button>
      <ol
        id={listId}
        data-testid="lesson-sections-nav"
        aria-label="Các mục trong bài"
        hidden={collapsed}
        className={`ml-5 mt-1 space-y-0.5 border-l border-token pl-2 ${collapsed ? "hidden" : "hidden lg:block"}`}
      >
        {secs.map((s, i) => (
          <li key={i}>
            <button
              type="button"
              aria-current={i === cur ? "location" : undefined}
              onClick={() => s.el.scrollIntoView({ block: "start", behavior: "smooth" })}
              className={`flex w-full items-baseline gap-2 px-2 py-1 text-left text-xs leading-snug hover:bg-black/5 ${i === cur ? "bg-brand-50 font-bold text-brand-800" : "text-muted"}`}
            >
              <span className="shrink-0 tabular-nums">{s.no}</span>
              <span className="min-w-0 flex-1">{s.label}</span>
            </button>
          </li>
        ))}
      </ol>
    </>
  );
}
