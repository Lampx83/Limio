/**
 * KPI tile cho instructor dashboards (skill coverage %, forum unresolved, etc).
 * Value lớn, label nhỏ, optional sub-text. Tone mapping nhất quán cho mọi
 * trang — không decision logic ở chỗ gọi.
 */
import type { ReactNode } from "react";

const TONE_CLASS = {
  brand: "text-brand-600",
  success: "text-success-600",
  warning: "text-yellow-700",
  info: "text-sky-600",
  accent: "text-accent-600",
  danger: "text-danger-600",
} as const;

export type KpiTone = keyof typeof TONE_CLASS;

interface KpiCardProps {
  label: string;
  value: string | number | ReactNode;
  sub?: ReactNode;
  tone?: KpiTone;
  className?: string;
}

export default function KpiCard({
  label,
  value,
  sub,
  tone = "brand",
  className = "",
}: KpiCardProps) {
  return (
    <div className={`card ${className}`}>
      <div
        className={`h-display text-2xl font-bold tabular-nums ${TONE_CLASS[tone]}`}
      >
        {value}
      </div>
      <div className="mt-1 text-xs text-muted sm:text-sm">{label}</div>
      {sub !== undefined && sub !== null && (
        <div className="mt-0.5 text-xs text-faint">{sub}</div>
      )}
    </div>
  );
}
