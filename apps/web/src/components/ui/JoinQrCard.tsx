"use client";

import dynamic from "next/dynamic";
import { X } from "lucide-react";
import QrZoom from "./QrZoom";

const QR_SIZE = 104;

const QRCodeSVG = dynamic(() => import("qrcode.react").then((m) => m.QRCodeSVG), {
  ssr: false,
  loading: () => <div style={{ width: QR_SIZE, height: QR_SIZE }} />,
});

// Class phải viết nguyên chữ để Tailwind quét được — không ghép chuỗi động.
const TONES = {
  brand: { ring: "ring-brand-200", code: "text-brand-700" },
  pink: { ring: "ring-pink-300", code: "text-pink-800" },
  emerald: { ring: "ring-emerald-300", code: "text-emerald-800" },
} as const;

/**
 * Khung QR nhỏ để tham gia một phiên hoạt động nhanh (vote, word cloud,
 * padlet, bảng vẽ…): nằm gọn ở góc, không chiếm chỗ của nội dung đang chạy.
 * Bấm vào QR để phóng to popup toàn màn hình cho cả lớp quét — popup có mã to,
 * link và nút sao chép (xem `QrZoom`).
 *
 * Vị trí do chỗ dùng quyết định qua `className` (vd. `fixed bottom-6 left-6 z-40`
 * ở màn chiếu, hay để mặc định khi đặt trong luồng trang).
 */
export default function JoinQrCard({
  url,
  code,
  title = "Quét để tham gia",
  tone = "brand",
  onHide,
  className = "",
}: {
  url: string;
  /** Mã tham gia — in dưới QR, và to hơn nữa trong popup. */
  code?: string;
  title?: string;
  tone?: keyof typeof TONES;
  /** Có thì hiện nút × ở góc để người dạy ẩn khung đi. */
  onHide?: () => void;
  className?: string;
}) {
  const t = TONES[tone];
  // Chỉ thêm `relative` (neo nút ×) khi chỗ dùng không tự định vị. Trong CSS
  // Tailwind, `relative` đứng sau `fixed`/`absolute` nên luôn đè lên — khung
  // "ghim góc" sẽ rơi xuống cuối luồng trang (bị đẩy khuất hoặc ra giữa đáy).
  const positioned = /(^|\s)(fixed|absolute|sticky)(\s|$)/.test(className);
  return (
    <div
      className={`${positioned ? "" : "relative "}flex flex-col items-center gap-1 rounded-xl bg-white p-2 shadow-lg ring-2 ${t.ring} ${className}`}
    >
      {onHide && (
        <button
          type="button"
          onClick={onHide}
          className="absolute -right-2 -top-2 z-10 rounded-full bg-white p-1 shadow ring-1 ring-gray-200 hover:bg-gray-100"
          aria-label="Ẩn khung QR"
          title="Ẩn khung QR"
        >
          <X size={12} aria-hidden />
        </button>
      )}
      {/* Nền trắng của thẻ đã là quiet zone; QR không tự thêm lề. */}
      <QrZoom url={url} title={title} code={code} copyable>
        <QRCodeSVG value={url} size={QR_SIZE} level="M" marginSize={0} />
      </QrZoom>
      {code && (
        <p className={`font-mono text-sm font-extrabold tracking-[0.15em] ${t.code}`}>{code}</p>
      )}
    </div>
  );
}
