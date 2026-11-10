"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * Ảnh trong đoạn văn phía học viên: nằm gọn trong bề rộng cột, căn giữa, giữ tỉ lệ, cao tối đa 28rem (ảnh dọc/dài thu lại cho vừa khung);
 * bấm vào ảnh để xem toàn cỡ (lớp phủ, nút đóng, phím Esc) — để ảnh bị thu nhỏ vẫn đọc được chữ trong ảnh.
 * docs/tieu-chi/bai-doc-anh-audio-xoa-transcript.md (AC2).
 */
export const PASSAGE_IMAGE_CLASS = "mx-auto block max-h-[28rem] w-auto max-w-full rounded border border-default object-contain";

export default function PassageImage({ src, alt }: { src: string; alt?: string }) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // không cuộn nền phía sau lớp phủ
    closeRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={alt ? `Xem ảnh toàn cỡ: ${alt}` : "Xem ảnh toàn cỡ"}
        className="my-3 block w-full cursor-zoom-in"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt ?? ""} className={PASSAGE_IMAGE_CLASS} />
      </button>
      {open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={alt || "Ảnh toàn cỡ"}
            data-testid="passage-image-lightbox"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6"
            onClick={() => setOpen(false)}
          >
            <button
              ref={closeRef}
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Đóng"
              className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-900 hover:bg-white"
            >
              <X size={20} aria-hidden />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={alt ?? ""} className="max-h-full max-w-full rounded bg-white object-contain" onClick={(e) => e.stopPropagation()} />
          </div>,
          document.body,
        )}
    </>
  );
}
