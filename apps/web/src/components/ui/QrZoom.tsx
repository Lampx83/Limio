"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode } from "react";
import { Check, Copy, Maximize2, X } from "lucide-react";
import { copyText } from "@/lib/clipboard";

const QRCodeSVG = dynamic(() => import("qrcode.react").then((m) => m.QRCodeSVG), {
  ssr: false,
});

/**
 * Bọc một QR nhỏ: bấm vào để phóng to toàn màn hình (chiếu lớp cho cả phòng
 * quét), kèm đường link ngay bên dưới. Esc hoặc bấm nền để đóng.
 *
 * `code` là mã tham gia gõ tay — đường dự phòng khi máy ảnh không bắt được QR,
 * nên được in to hơn cả link. `copyable` thêm nút sao chép link trong popup.
 */
export default function QrZoom({
  url,
  title,
  code,
  copyable = false,
  children,
}: {
  url: string;
  title?: string;
  /** Mã tham gia, in cỡ lớn dưới QR. */
  code?: string;
  copyable?: boolean;
  /** QR thu nhỏ hiển thị ở trạng thái đóng. */
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState(480);
  const [copied, setCopied] = useState<"ok" | "failed" | null>(null);

  useEffect(() => {
    if (!open) return;
    setCopied(null);
    // Chừa chỗ cho mã + nút copy bên dưới QR.
    const reserved = 280 + (code ? 80 : 0) + (copyable ? 56 : 0);
    const fit = () =>
      setSize(Math.max(200, Math.min(window.innerWidth - 64, window.innerHeight - reserved, 720)));
    fit();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("resize", fit);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", fit);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, code, copyable]);

  async function onCopy() {
    const ok = await copyText(url);
    setCopied(ok ? "ok" : "failed");
    if (ok) setTimeout(() => setCopied(null), 2000);
  }

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
          {code && (
            <p
              onClick={(e) => e.stopPropagation()}
              className="select-all text-center font-mono text-5xl font-extrabold tracking-[0.25em] text-white sm:text-6xl"
            >
              {code}
            </p>
          )}
          <p
            onClick={(e) => e.stopPropagation()}
            className={
              code
                ? "max-w-full select-all break-all text-center font-mono text-base leading-tight text-white/80 sm:text-xl"
                : "max-w-full select-all break-all text-center font-mono text-2xl font-bold leading-tight text-white sm:text-4xl"
            }
          >
            {url}
          </p>
          {copyable && (
            <div onClick={(e) => e.stopPropagation()} className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={onCopy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20"
              >
                {copied === "ok" ? (
                  <Check className="h-4 w-4" aria-hidden />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden />
                )}
                {copied === "ok" ? "Đã sao chép" : "Sao chép link"}
              </button>
              {copied === "failed" && (
                <p role="alert" className="text-caption text-white/80">
                  Không sao chép được — bôi đen link ở trên rồi copy tay giúp.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
