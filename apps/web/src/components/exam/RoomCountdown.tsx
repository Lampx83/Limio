"use client";

import { useEffect, useRef, useState } from "react";
import { Timer } from "lucide-react";

/** Các mốc báo còn bao lâu (giây). Chỉ báo mốc còn nhỏ hơn tổng thời lượng. */
const WARN_AT_SEC = [300, 120, 60] as const;

/**
 * Đồng hồ của phòng vấn đáp: chữ mm:ss + thanh tiến độ dưới header + thông báo nổi ở mốc còn 5, 2, 1 phút.
 *
 * Tách khỏi phòng thi vì hai lẽ. (1) Dữ liệu thật: nhiều sinh viên báo "không biết lúc nào hết giờ", 23% lượt
 * bị cắt vì hết giờ mà chỉ có một con số nhỏ ở góc — không ai báo trước. (2) Đồng hồ nhảy mỗi giây; để nó ở
 * trong phòng thi thì cả phòng, kể cả ô nhập, dựng lại mỗi giây và có thể làm gián đoạn bộ gõ tiếng Việt.
 *
 * Phần tử thanh tiến độ định vị `absolute` ở đáy nên header chứa nó phải là `relative`.
 */
export default function RoomCountdown({
  deadlineEpoch,
  clockSkewMs,
  totalSec,
  onExpire,
}: {
  deadlineEpoch: number;
  clockSkewMs: number;
  totalSec: number;
  /** Gọi ĐÚNG MỘT LẦN khi hết giờ. */
  onExpire: () => void;
}) {
  const compute = () => Math.max(0, Math.floor((deadlineEpoch - (Date.now() + clockSkewMs)) / 1000));
  const [remainingSec, setRemainingSec] = useState(compute);
  const [toast, setToast] = useState<string | null>(null);
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;
  const warned = useRef(new Set<number>());

  useEffect(() => {
    let toastTimer: ReturnType<typeof setTimeout> | null = null;
    const t = setInterval(() => {
      const r = Math.max(0, Math.floor((deadlineEpoch - (Date.now() + clockSkewMs)) / 1000));
      setRemainingSec(r);
      for (const mark of WARN_AT_SEC) {
        if (r > 0 && r <= mark && mark < totalSec && !warned.current.has(mark)) {
          warned.current.add(mark);
          // Nhảy cóc qua mốc (tab bị treo) chỉ báo mốc nhỏ nhất vừa chạm.
          setToast(`Còn ${mark / 60} phút`);
          if (toastTimer) clearTimeout(toastTimer);
          toastTimer = setTimeout(() => setToast(null), 6_000);
        }
      }
      if (r <= 0) {
        clearInterval(t);
        expireRef.current();
      }
    }, 1_000);
    return () => {
      clearInterval(t);
      if (toastTimer) clearTimeout(toastTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadlineEpoch, clockSkewMs, totalSec]);

  const minutes = Math.floor(remainingSec / 60);
  const seconds = remainingSec % 60;
  const urgent = remainingSec <= 120;
  const soon = remainingSec <= 300;
  const pct = totalSec > 0 ? Math.min(100, Math.max(0, (remainingSec / totalSec) * 100)) : 0;

  return (
    <>
      <span
        role="timer"
        aria-label={`Còn ${minutes} phút ${seconds} giây`}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold tabular-nums ${
          urgent
            ? "animate-pulse bg-red-100 text-red-700"
            : soon
              ? "bg-amber-100 text-amber-800"
              : "bg-slate-100 text-slate-700"
        }`}
      >
        <Timer className="h-4 w-4" />
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </span>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-slate-200/70">
        <div
          className={`h-full transition-[width] duration-1000 ease-linear ${
            urgent ? "bg-red-500" : soon ? "bg-amber-500" : "bg-lime-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed left-1/2 top-16 z-[55] -translate-x-1/2 rounded-full bg-slate-900/90 px-4 py-2 text-sm font-semibold text-white shadow-lg"
        >
          ⏱ {toast}
        </div>
      )}
    </>
  );
}
