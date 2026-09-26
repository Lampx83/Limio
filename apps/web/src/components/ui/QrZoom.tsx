"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode } from "react";
import { Maximize2, X } from "lucide-react";

const QRCodeSVG = dynamic(() => import("qrcode.react").then((m) => m.QRCodeSVG), {
  ssr: false,
});

/**
 * Bọc một QR nhỏ: bấm vào để phóng to toàn màn hình (chiếu lớp cho cả phòng
 * quét), kèm đường link ngay bên dưới. Esc hoặc bấm nền để đóng.
 */
export default function QrZoom({
  url,
  title,
  children,
}: {
  url: string;
  title?: string;
  /** QR thu nhỏ hiển thị ở trạng thái đóng. */
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState(480);

  useEffect(() => {
    if (!open) return;
    const fit = () =>
      setSize(Math.max(200, Math.min(window.innerWidth - 64, window.innerHeight - 280, 720)));
    fit();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("resize", fit);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", fit);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative rounded-lg"
        aria-label="Phóng to mã QR"
        title="Bấm để phóng to"
      >
        {children}
        <span className="absolute right-1 top-1 rounded bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <Maximize2 className="h-3 w-3" aria-hidden />
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title ?? "Mã QR"}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-black/80 p-4"
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
          {title && <p className="text-h3 text-white">{title}</p>}
          <div className="rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <QRCodeSVG value={url} size={size} level="M" />
          </div>
          <p
            onClick={(e) => e.stopPropagation()}
            className="max-w-full select-all break-all text-center font-mono text-2xl font-bold leading-tight text-white sm:text-4xl"
          >
            {url}
          </p>
        </div>
      )}
    </>
  );
}
