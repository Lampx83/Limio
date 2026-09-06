"use client";

import { useEffect, useState } from "react";
import { Maximize2, Minimize2, Printer } from "lucide-react";

/**
 * Hai nút công cụ của bài học: xem toàn màn hình và in ra PDF.
 *
 * Không tự bọc thanh riêng — nó được xếp chung hàng với nút mục lục ở đầu
 * trang, để mọi hành động của bài nằm một chỗ thay vì rải hai tầng.
 *
 * "Toàn màn hình" phóng đúng khối nội dung chứ không phải cả trang — người học
 * đang đọc thì thanh điều hướng, tab bài tập và diễn đàn chỉ là nhiễu. Dùng
 * Fullscreen API của trình duyệt nên thoát bằng Esc như mọi chỗ khác, không
 * phải học thêm quy ước riêng của sản phẩm.
 */
export default function LessonContentToolbar({
  targetId,
  printHref,
  className = "btn-pill",
}: {
  targetId: string;
  printHref: string;
  /** Kiểu nút — mặc định đồng bộ với các nút còn lại ở đầu trang. */
  className?: string;
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
    <>
      {supported && (
        <button
          type="button"
          onClick={toggle}
          aria-pressed={isFull}
          className={`${className} print:hidden`}
        >
          {isFull ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          {isFull ? "Thoát toàn màn hình" : "Toàn màn hình"}
        </button>
      )}
      <a
        href={printHref}
        target="_blank"
        rel="noopener noreferrer"
        className={`${className} print:hidden`}
      >
        <Printer size={16} />
        In / Lưu PDF
      </a>
    </>
  );
}
