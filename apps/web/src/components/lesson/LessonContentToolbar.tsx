"use client";

import { useEffect, useState } from "react";
import { Maximize2, Minimize2, Printer } from "lucide-react";

/**
 * Thanh công cụ nhỏ phía trên nội dung bài: xem toàn màn hình và in ra PDF.
 *
 * "Toàn màn hình" phóng đúng khối nội dung chứ không phải cả trang — người học
 * đang đọc thì thanh điều hướng, tab bài tập và diễn đàn chỉ là nhiễu. Dùng
 * Fullscreen API của trình duyệt nên thoát bằng Esc như mọi chỗ khác, không
 * phải học thêm quy ước riêng của sản phẩm.
 */
export default function LessonContentToolbar({
  targetId,
  printHref,
}: {
  targetId: string;
  printHref: string;
}) {
  const [isFull, setIsFull] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(typeof document !== "undefined" && document.fullscreenEnabled);
    const onChange = () => setIsFull(document.fullscreenElement?.id === targetId);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [targetId]);

  const toggle = async () => {
    const el = document.getElementById(targetId);
    if (!el) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await el.requestFullscreen();
    } catch {
      // Trình duyệt từ chối (thường vì thiếu thao tác người dùng hoặc iframe
      // không cho phép) — im lặng, nút vẫn ở đó để bấm lại.
    }
  };

  return (
    <div className="mb-3 flex flex-wrap items-center justify-end gap-2 print:hidden">
      {supported && (
        <button
          type="button"
          onClick={toggle}
          aria-pressed={isFull}
          className="inline-flex items-center gap-1.5 rounded-full border border-token px-3 py-1 text-xs font-medium text-muted transition-colors hover:bg-[rgb(var(--surface-muted))] hover:text-[rgb(var(--text))]"
        >
          {isFull ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          {isFull ? "Thoát toàn màn hình" : "Toàn màn hình"}
        </button>
      )}
      <a
        href={printHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-full border border-token px-3 py-1 text-xs font-medium text-muted transition-colors hover:bg-[rgb(var(--surface-muted))] hover:text-[rgb(var(--text))]"
      >
        <Printer size={14} />
        In / Lưu PDF
      </a>
    </div>
  );
}
