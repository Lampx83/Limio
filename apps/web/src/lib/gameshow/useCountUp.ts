import { useEffect, useRef, useState } from "react";

/** Số chạy đếm lên tới `value` trong ~500ms mỗi khi value đổi — hiệu ứng
 * bảng điểm "tăng dần" kiểu Kahoot. Thuần trình bày, không phải nguồn dữ
 * liệu — `value` vẫn luôn là điểm thật từ server. */
export function useCountUp(value: number, durationMs = 500): number {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) * (1 - t);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(step);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return display;
}
