/**
 * Status badge với màu semantic + tuỳ chọn pulse (cho trạng thái "live").
 */

const TONE_CLASS = {
  neutral: "bg-[rgb(var(--surface-muted))] text-[rgb(var(--text-muted))]",
  brand: "bg-[rgb(var(--brand-soft))] text-[rgb(var(--brand))]",
  success: "bg-success-100 text-success-700",
  warning: "bg-yellow-100 text-yellow-800",
  info: "bg-sky-100 text-sky-700",
  danger: "bg-danger-100 text-danger-700",
  accent: "bg-accent-100 text-accent-700",
} as const;

const DOT_CLASS = {
  neutral: "bg-gray-400",
  brand: "bg-brand-500",
  success: "bg-success-500",
  warning: "bg-yellow-500",
  info: "bg-sky-500",
  danger: "bg-danger-500",
  accent: "bg-accent-500",
} as const;

export type StatusTone = keyof typeof TONE_CLASS;

interface StatusBadgeProps {
  children: React.ReactNode;
  tone?: StatusTone;
  pulse?: boolean;
  dot?: boolean;
  className?: string;
}

export default function StatusBadge({
  children,
  tone = "neutral",
  pulse = false,
  dot = true,
  className = "",
}: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASS[tone]} ${className}`}
    >
      {dot && (
        <span className="relative inline-flex h-2 w-2" aria-hidden>
          {pulse && (
            <span
              className={`absolute inset-0 inline-flex h-full w-full rounded-full opacity-75 ${DOT_CLASS[tone]} animate-ping`}
            />
          )}
          <span
            className={`relative inline-flex h-2 w-2 rounded-full ${DOT_CLASS[tone]}`}
          />
        </span>
      )}
      {children}
    </span>
  );
}
