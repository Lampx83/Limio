"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ScanLine, X } from "lucide-react";

// Lấy mã thi từ nội dung QR: có thể là link đầy đủ (…/exam/ABC123) hoặc chính
// mã thi. Backend dùng mã 6 (mở) hoặc 8 (gán sẵn) ký tự chữ-số viết hoa.
function extractExamCode(raw: string): string | null {
  const text = raw.trim();
  const m = text.match(/\/exam\/([A-Za-z0-9]{6,8})(?:[/?#]|$)/);
  if (m?.[1]) return m[1].toUpperCase();
  if (/^[A-Za-z0-9]{6,8}$/.test(text)) return text.toUpperCase();
  return null;
}

/**
 * Nút quét QR vào thi — chỉ hiện ở mobile (`sm:hidden`), đặt cạnh chuông
 * thông báo trên header. Ưu tiên BarcodeDetector native, fallback jsQR
 * (iOS Safari chưa có BarcodeDetector).
 */
export default function ScanExamQrButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    let stopped = false;
    let stream: MediaStream | null = null;
    let raf = 0;

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setErr("Trình duyệt không hỗ trợ mở camera. Hãy nhập mã thi thủ công.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch {
        setErr("Không mở được camera. Hãy cấp quyền camera cho trình duyệt rồi thử lại.");
        return;
      }
      if (stopped) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play().catch(() => {});

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Native = (window as any).BarcodeDetector;
      const detector = Native ? new Native({ formats: ["qr_code"] }) : null;
      const jsQR = detector ? null : (await import("jsqr")).default;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      const handle = (value: string) => {
        const code = extractExamCode(value);
        if (!code) {
          setErr("QR này không phải mã vào thi. Hãy quét QR do giám thị cung cấp.");
          return false;
        }
        stopped = true;
        setOpen(false);
        router.push(`/exam/${code}`);
        return true;
      };

      const tick = async () => {
        if (stopped) return;
        if (video.readyState >= 2 && video.videoWidth > 0) {
          try {
            if (detector) {
              const found = await detector.detect(video);
              if (found[0]?.rawValue && handle(found[0].rawValue)) return;
            } else if (jsQR && ctx) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              ctx.drawImage(video, 0, 0);
              const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const res = jsQR(img.data, img.width, img.height);
              if (res?.data && handle(res.data)) return;
            }
          } catch {
            /* khung hình lỗi — thử khung kế */
          }
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    start();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open, router]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Quét QR vào thi"
        title="Quét QR vào thi"
        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 sm:hidden"
      >
        <ScanLine className="h-5 w-5" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Quét QR vào thi"
          className="fixed inset-0 z-50 flex flex-col bg-black"
        >
          <div className="flex items-center justify-between p-4 text-white">
            <span className="font-semibold">Quét QR vào thi</span>
            <button
              type="button"
              onClick={close}
              aria-label="Đóng"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="relative flex-1">
            <video
              ref={videoRef}
              playsInline
              muted
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-2xl border-4 border-white/80" />
          </div>
          <div className="p-4 text-center text-sm text-white">
            {err ?? "Đưa mã QR của ca thi vào khung hình."}
          </div>
        </div>
      )}
    </>
  );
}
