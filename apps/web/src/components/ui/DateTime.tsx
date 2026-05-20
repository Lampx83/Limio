"use client";

import { useEffect, useState } from "react";

/**
 * Hiển thị ngày/giờ theo locale VN với 4 mode:
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

function fmtDate(d: Date): string {
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 1000 * 60 * 60 * 24 * 365],
  ["month", 1000 * 60 * 60 * 24 * 30],
  ["week", 1000 * 60 * 60 * 24 * 7],
  ["day", 1000 * 60 * 60 * 24],
  ["hour", 1000 * 60 * 60],
  ["minute", 1000 * 60],
  ["second", 1000],
];

function fmtRelative(d: Date, now: Date = new Date()): string {
  const diff = d.getTime() - now.getTime();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("vi", { numeric: "auto" });
  for (const [unit, ms] of UNITS) {
    if (abs >= ms || unit === "second") {
      return rtf.format(Math.round(diff / ms), unit);
    }
  }
  return "";
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
    <time dateTime={d.toISOString()} title={d.toLocaleString("vi-VN")} className={className}>
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
