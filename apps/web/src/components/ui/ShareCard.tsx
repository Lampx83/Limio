"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Check, Copy, Download, QrCode } from "lucide-react";
import { shareUrl } from "@/lib/apiUrl";
import { copyText } from "@/lib/clipboard";
import QrZoom from "./QrZoom";

const QR_DISPLAY_SIZE = 176;
/** QR để in/chiếu: 1024px là đủ nét cho A4 lẫn slide máy chiếu. */
const QR_EXPORT_SIZE = 1024;

const QRCodeSVG = dynamic(() => import("qrcode.react").then((m) => m.QRCodeSVG), {
  ssr: false,
  loading: () => (
    <div
      className="rounded-lg bg-white"
      style={{ width: QR_DISPLAY_SIZE, height: QR_DISPLAY_SIZE }}
    />
  ),
});

const QRCodeCanvas = dynamic(() => import("qrcode.react").then((m) => m.QRCodeCanvas), {
  ssr: false,
});

/**
 * Link chia sẻ + QR cho một trang công khai (khoá học, tournament…).
 *
 * Nhận `path` nội bộ chứ không nhận URL tuyệt đối: link tuyệt đối phải do
 * `shareUrl()` dựng, vì production chạy dưới một tiền tố đường dẫn — ghép tay
 * `location.origin + path` ra link 404 mà dev không bao giờ lộ.
 *
 * URL được tính sau khi mount: `shareUrl` đọc `window`, tính lúc SSR sẽ ra
 * chuỗi khác lúc hydrate.
 */
export default function ShareCard({
  path,
  label = "Link giới thiệu",
  hint,
  fileName,
}: {
  path: string;
  label?: string;
  hint?: string;
  fileName?: string;
}) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUrl(shareUrl(path));
  }, [path]);

  async function onCopy() {
    const ok = await copyText(url);
    setCopyFailed(!ok);
    if (!ok) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function onDownloadQr() {
    const canvas = exportRef.current?.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${fileName ?? slugFromPath(path)}-qr.png`;
    a.click();
  }

  return (
    <div className="rounded-2xl border border-token bg-[rgb(var(--surface-muted))] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">{label}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCopy}
            disabled={!url}
            className="btn-secondary btn-sm inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" aria-hidden />
                Đã sao chép
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" aria-hidden />
                Sao chép
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setQrOpen((v) => !v)}
            aria-expanded={qrOpen}
            className="btn-secondary btn-sm inline-flex items-center gap-1.5"
          >
            <QrCode className="h-3.5 w-3.5" aria-hidden />
            {qrOpen ? "Ẩn QR" : "Mã QR"}
          </button>
        </div>
      </div>

      <p className="mt-2 break-all font-mono text-xs text-muted">
        {url || `${path} …`}
      </p>

      {hint && <p className="mt-1 text-caption text-muted">{hint}</p>}

      {/* Nói thật khi clipboard hỏng — báo "đã copy" trong khi không copy được
          là kiểu hỏng khó lần nhất (xem lib/clipboard.ts). */}
      {copyFailed && (
        <p role="alert" className="mt-1 text-caption text-danger-600">
          Không sao chép được — bôi đen link ở trên rồi copy tay giúp.
        </p>
      )}

      {qrOpen && url && (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          {/* Nền trắng + đệm quiet zone: QR sát mép hoặc trên nền màu thì máy
              quét hay không bắt được. */}
          <QrZoom url={url} title={label}>
            <div className="rounded-lg border border-token bg-white p-3">
              <QRCodeSVG value={url} size={QR_DISPLAY_SIZE} level="M" />
            </div>
          </QrZoom>
          <button
            type="button"
            onClick={onDownloadQr}
            className="btn-secondary btn-sm inline-flex items-center gap-1.5"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Tải PNG
          </button>
          {/* Bản {QR_EXPORT_SIZE}px chỉ để xuất file — canvas ngoài màn hình,
              không dùng display:none vì canvas ẩn vẫn phải vẽ được. */}
          <div
            ref={exportRef}
            aria-hidden
            className="pointer-events-none fixed -left-[9999px] top-0"
          >
            <QRCodeCanvas value={url} size={QR_EXPORT_SIZE} level="M" marginSize={2} />
          </div>
        </div>
      )}
    </div>
  );
}

function slugFromPath(path: string): string {
  const last = path.split("/").filter(Boolean).pop();
  return last ? last.slice(0, 60) : "share";
}
