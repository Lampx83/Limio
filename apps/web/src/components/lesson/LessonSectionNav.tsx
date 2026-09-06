"use client";

import { useEffect, useState } from "react";

type Section = { id: string; text: string };

/**
 * Mục lục nổi bên trái trang bài học, có đánh dấu mục đang đọc.
 *
 * Đọc thẳng các thẻ `h2[id]` mà học liệu sinh ra (xem `import-course.ts`) thay
 * vì nhận danh sách mục từ máy chủ: nội dung bài nằm trong DB dưới dạng HTML,
 * nên nơi duy nhất biết chắc bài có những mục nào là chính DOM sau khi render.
 *
 * Hai điều khiến việc này không tầm thường:
 *  1. `SafeHtml` làm sạch nội dung trong useEffect, nên lúc component này mount
 *     thì thân bài **chưa có trong DOM**. Phải chờ bằng MutationObserver.
 *  2. Mục "đang đọc" không phải mục nằm giữa màn hình mà là mục gần mép trên —
 *     nên vùng quan sát bị bóp lại còn dải hẹp phía trên (rootMargin âm ở dưới).
 */
export default function LessonSectionNav({ containerId }: { containerId: string }) {
  const [sections, setSections] = useState<Section[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Thu thập mục, chờ tới khi nội dung được đổ vào DOM.
  useEffect(() => {
    const root = document.getElementById(containerId);
    if (!root) return;

    const scan = () => {
      const found = [...root.querySelectorAll<HTMLElement>("h2[id]")].map((h) => ({
        id: h.id,
        // Bỏ số thứ tự trong huy hiệu: nav tự đánh số lại.
        text: (h.querySelector("span:last-of-type")?.textContent ?? h.textContent ?? "").trim(),
      }));
      setSections((prev) =>
        prev.length === found.length && prev.every((p, i) => p.id === found[i]!.id) ? prev : found,
      );
      return found.length > 0;
    };

    if (scan()) return;
    const mo = new MutationObserver(() => {
      if (scan()) mo.disconnect();
    });
    mo.observe(root, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [containerId]);

  // Đánh dấu mục đang đọc.
  useEffect(() => {
    if (sections.length === 0) return;
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((e): e is HTMLElement => e !== null);
    if (els.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          setActiveId(visible[0].target.id);
          return;
        }
        // Không mục nào nằm trong dải quan sát (đang ở giữa một mục dài):
        // giữ mục cuối cùng đã đi qua.
        const passed = els.filter((e) => e.getBoundingClientRect().top < 120);
        if (passed.length > 0) setActiveId(passed[passed.length - 1]!.id);
      },
      { rootMargin: "-88px 0px -65% 0px", threshold: 0 },
    );
    for (const el of els) io.observe(el);
    return () => io.disconnect();
  }, [sections]);

  // Bài ngắn không cần mục lục nổi — dưới 2 mục thì nó chỉ chiếm chỗ.
  if (sections.length < 2) return null;

  return (
    <nav
      aria-label="Mục lục bài học"
      className="hidden xl:block print:hidden"
    >
      <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-faint">
          Trong bài này
        </p>
        <ol className="space-y-0.5 border-l border-token">
          {sections.map((s, i) => {
            const active = s.id === activeId;
            return (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  aria-current={active ? "true" : undefined}
                  className={`-ml-px flex gap-2 border-l-2 py-1.5 pl-3 text-xs leading-snug transition-colors ${
                    active
                      ? "border-brand-600 font-semibold text-[rgb(var(--text))]"
                      : "border-transparent text-muted hover:border-token hover:text-[rgb(var(--text))]"
                  }`}
                >
                  <span className="shrink-0 tabular-nums">{i + 1}.</span>
                  <span>{s.text}</span>
                </a>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
