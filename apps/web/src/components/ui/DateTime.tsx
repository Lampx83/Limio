"use client";

import { useEffect, useState } from "react";
import {
  formatDate as fmtDate,
  formatRelative as fmtRelative,
  formatTime as fmtTime,
} from "@/lib/datetime";

/**
 * Hiển thị ngày/giờ theo locale VN, timezone cố định Asia/Ho_Chi_Minh (xem
 * lib/datetime.ts). 4 mode:
 *  - format="date"        → 20/05/2026
 *  - format="datetime"    → 20/05/2026 14:30
 *  - format="time"        → 14:30
 *  - format="relative"    → "2 giờ nữa" / "3 ngày trước" (auto refresh mỗi phút)
 *
 * Countdown đến mốc tương lai dùng <Countdown to={...}/>.
 */

type Format = "date" | "datetime" | "time" | "relative";

interface DateTimeProps {
  value: Date | string | number;
  format?: Format;
  className?: string;
}

function toDate(v: Date | string | number): Date {
  return v instanceof Date ? v : new Date(v);
}

export default function DateTime({
  value,
  format = "datetime",
  className,
}: DateTimeProps) {
  const d = toDate(value);
  // Để relative không phụ thuộc giờ máy SSR mismatch, tính lại trên client.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    if (format !== "relative") return;
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, [format]);

  let text: string;
  if (format === "date") text = fmtDate(d);
  else if (format === "time") text = fmtTime(d);
  else if (format === "datetime") text = `${fmtDate(d)} ${fmtTime(d)}`;
  else text = now ? fmtRelative(d, now) : fmtDate(d);

  return (
    <time
      dateTime={d.toISOString()}
      title={`${fmtDate(d)} ${fmtTime(d)}`}
      className={className}
    >
      {text}
    </time>
  );
}

interface CountdownProps {
  to: Date | string | number;
  /** Khi đếm về 0, hiện text này (mặc định "Đã bắt đầu"). */
  endedText?: string;
  className?: string;
  /** Show seconds (default false — minute resolution). */
  showSeconds?: boolean;
}

export function Countdown({
  to,
  endedText = "Đã bắt đầu",
  className,
  showSeconds = false,
}: CountdownProps) {
  const target = toDate(to).getTime();
  const [now, setNow] = useState<number>(() => target - 1); // SSR placeholder

  useEffect(() => {
    setNow(Date.now());
    const interval = showSeconds ? 1000 : 30_000;
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [showSeconds]);

  const diff = target - now;
  if (diff <= 0) return <span className={className}>{endedText}</span>;

  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} ngày`);
  if (days > 0 || hours > 0) parts.push(`${hours} giờ`);
  parts.push(`${minutes} phút`);
  if (showSeconds && days === 0 && hours === 0) parts.push(`${seconds}s`);

  return (
    <span className={className} aria-live="polite">
      còn {parts.join(" ")}
    </span>
  );
}
