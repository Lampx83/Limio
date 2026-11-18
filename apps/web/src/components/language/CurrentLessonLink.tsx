"use client";

import Link from "next/link";
import { RAIL_SECTIONS_TOGGLE_EVENT } from "@/lib/railSections";

/**
 * Dòng của bài đang xem trong thanh bài: bấm vào đâu trên dòng cũng thu gọn/mở danh sách mục bên dưới (không phải nhắm vào mũi tên), vì bấm lại chính bài
 * đang xem chỉ tải lại trang. Chỉ chặn khi danh sách mục đang có trên trang (bài có mục có số, màn hình từ `lg`); không thì vẫn là liên kết bình thường,
 * và bấm kèm Ctrl/Cmd/Shift (mở tab mới) luôn đi theo liên kết.
 */
export default function CurrentLessonLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current="page"
      className={className}
      onClick={(e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (!document.querySelector('[data-testid="lesson-sections-nav"]')) return;
        if (!window.matchMedia("(min-width: 1024px)").matches) return;
        e.preventDefault();
        window.dispatchEvent(new Event(RAIL_SECTIONS_TOGGLE_EVENT));
      }}
    >
      {children}
    </Link>
  );
}
