"use client";

import { useLessonSections } from "./useLessonSections";

/**
 * Mục lục phần của bài đang xem, nằm ngay dưới bài đó trong thanh bài bên trái (docs/tieu-chi/limio-language-ux-p1-ly-thuyet.md, mục F): các mục có số
 * (01 Tình huống, 02 Hội thoại…) đọc thẳng từ tiêu đề mục `.hsk-sh` của nội dung bài; mục đang đọc tô đậm khi cuộn, bấm thì cuộn tới mục.
 * Bài không có mục có số (khoá khác) thì không hiện gì. Chỉ hiện từ `lg` (dưới `lg` thanh bài nằm trong thanh điều hướng một dòng).
 */
export default function LessonSectionsNav() {
  const { secs, cur } = useLessonSections();

  if (secs.length === 0) return null;
  return (
    <ol data-testid="lesson-sections-nav" aria-label="Các mục trong bài" className="ml-5 mt-1 hidden space-y-0.5 border-l border-token pl-2 lg:block">
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
  );
}
