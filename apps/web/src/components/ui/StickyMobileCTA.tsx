/**
 * Thanh CTA fixed-bottom chỉ hiện trên mobile (< lg).
 * Từ lg trở lên thì action ẩn — kỳ vọng đặt trong sidebar/hero ở desktop.
 *
 * Dùng trong: Catalog detail (Enroll), Learner course (Tiếp tục bài),
 * Forum thread (Reply), Exam (Nộp bài), Assignment submit, etc.
 */
import type { ReactNode } from "react";

interface StickyMobileCTAProps {
  /** Nội dung hiển thị bên trái (label/price/progress). */
  primary?: ReactNode;
  /** Nội dung phụ phía dưới primary. */
  secondary?: ReactNode;
  /** Nút action chính (đặt button/link tự chuẩn bị, vd .btn-primary). */
  action: ReactNode;
  className?: string;
}

export default function StickyMobileCTA({
  primary,
  secondary,
  action,
  className = "",
}: StickyMobileCTAProps) {
  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-40 lg:hidden border-t border-token bg-[rgb(var(--surface))] px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] backdrop-blur supports-[backdrop-filter]:bg-[rgb(var(--surface)/0.92)] ${className}`}
      // safe-area cho iPhone
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
      role="region"
      aria-label="Hành động chính"
    >
      <div className="flex items-center gap-3">
        {(primary || secondary) && (
          <div className="min-w-0 flex-1">
            {primary && (
              <div className="truncate text-sm font-semibold text-[rgb(var(--text))]">
                {primary}
              </div>
            )}
            {secondary && (
              <div className="truncate text-xs text-[rgb(var(--text-muted))]">
                {secondary}
              </div>
            )}
          </div>
        )}
        <div className="shrink-0">{action}</div>
      </div>
    </div>
  );
}
