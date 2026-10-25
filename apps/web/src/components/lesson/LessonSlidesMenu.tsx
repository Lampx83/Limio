"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Headphones, Presentation, Users } from "lucide-react";

/**
 * Nút "Xem slide" của người sửa được khoá (docs/tieu-chi/nghe-giang-slide.md, AC6): hai việc khác nhau với cùng một bài giảng.
 * - "Xem slide để dạy": mở bài giảng tương tác (Limio-Live) để dạy trực tiếp.
 * - "Xem slide để nghe giảng": chạy như học viên sẽ thấy, dạng slideshow.
 * Học viên không có nút này; nút nghe giảng slide của họ chỉ hiện khi bài đã có giọng.
 */
export default function LessonSlidesMenu({ deckId, courseSlug, lessonId }: { deckId: string; courseSlug: string; lessonId: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item = "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-[rgb(var(--surface-muted))]";

  return (
    <div ref={rootRef} className="relative print:hidden">
      <button type="button" className="btn-pill" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Presentation size={16} />
        Xem slide
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" className="absolute left-0 z-30 mt-2 w-64 rounded-xl border border-token bg-[rgb(var(--surface))] p-1 shadow-card">
          <Link role="menuitem" href={`/instructor/limio-live/${deckId}/present?from=start`} className={item} prefetch={false} onClick={() => setOpen(false)}>
            <Users size={16} aria-hidden="true" />
            Xem slide để dạy
          </Link>
          <Link role="menuitem" href={`/learn/${courseSlug}/lessons/${lessonId}/slides`} className={item} prefetch={false} onClick={() => setOpen(false)}>
            <Headphones size={16} aria-hidden="true" />
            Xem slide để nghe giảng
          </Link>
        </div>
      )}
    </div>
  );
}
