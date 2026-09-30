"use client";

import { useEffect, useRef, useState } from "react";

// Kích thước khổ A4 ngang theo điểm (pt), cùng hệ toạ độ với bản PDF
// (apps/web/src/lib/certificatePdf.tsx).
const A4_W = 841.89;
const A4_H = 595.28;

/**
 * Preview chứng nhận luôn là A4 ngang. Bố cục dựng trên canvas cố định
 * 841.89×595.28 rồi phóng/thu theo bề rộng khung chứa — nên cửa sổ hẹp chỉ làm
 * chứng nhận nhỏ đi chứ không làm nội dung tràn/bị xén như khi co khung theo
 * aspect-ratio nhưng giữ nguyên cỡ chữ.
 */
export default function CertificateCanvas({ children }: { children: React.ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / A4_W);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={outerRef}
      className="relative mx-auto mt-6 w-full max-w-5xl overflow-hidden shadow-card-hover print:shadow-none"
      style={{ aspectRatio: `${A4_W} / ${A4_H}` }}
    >
      <div
        style={{
          width: A4_W,
          height: A4_H,
          transform: `scale(${scale ?? 1})`,
          transformOrigin: "top left",
          // Ẩn tới khi đo xong bề rộng để không nháy khung cỡ thật rồi mới thu.
          visibility: scale === null ? "hidden" : "visible",
        }}
      >
        {children}
      </div>
    </div>
  );
}
