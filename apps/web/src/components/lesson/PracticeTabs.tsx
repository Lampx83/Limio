"use client";

import { useId, useState } from "react";

export interface PracticeTab {
  id: string;
  label: string;
  content: React.ReactNode;
}

/**
 * Khu "Luyện tập" của bài ngoại ngữ: mỗi khối Bài luyện là một tab (docs/tieu-chi/limio-language-y-kien-hoc-vien-giao-dien.md, AC5).
 * Mọi tab đều nằm trong cây (tab không chọn chỉ ẩn) nên bài đang làm không mất khi chuyển qua lại.
 * Chỉ một khối thì không có thanh tab.
 */
export default function PracticeTabs({ tabs }: { tabs: PracticeTab[] }) {
  const uid = useId();
  const [active, setActive] = useState(0);
  if (tabs.length === 0) return null;
  if (tabs.length === 1) return <div>{tabs[0]!.content}</div>;
  const cur = Math.min(active, tabs.length - 1);
  const go = (i: number) => setActive((i + tabs.length) % tabs.length);

  return (
    <section className="mt-8" data-testid="practice-tabs">
      <h2 className="text-h3 mb-2">Luyện tập</h2>
      <div
        role="tablist"
        aria-label="Bài luyện của bài học"
        className="-mx-2 flex gap-1 overflow-x-auto border-b border-token px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((t, i) => {
          const on = i === cur;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`${uid}-tab-${i}`}
              aria-selected={on}
              aria-controls={`${uid}-panel-${i}`}
              tabIndex={on ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") {
                  e.preventDefault();
                  go(cur + 1);
                } else if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  go(cur - 1);
                }
              }}
              className={`shrink-0 border-b-2 px-3.5 py-2.5 text-sm font-semibold transition-colors sm:text-base ${
                on ? "border-brand-600 text-brand-700" : "border-transparent text-muted hover:text-[rgb(var(--text))]"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {tabs.map((t, i) => (
        <div key={t.id} role="tabpanel" id={`${uid}-panel-${i}`} aria-labelledby={`${uid}-tab-${i}`} hidden={i !== cur}>
          {t.content}
        </div>
      ))}
    </section>
  );
}
