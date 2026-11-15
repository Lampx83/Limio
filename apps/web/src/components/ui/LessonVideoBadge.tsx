import { PlayCircle } from "lucide-react";

/**
 * Dấu "bài này có video" cạnh tên bài trong các danh sách bài. Thuần trình bày, không gọi i18n: nơi dùng (server hay client)
 * truyền sẵn chuỗi đã dịch. Nhãn đọc được cho trình đọc màn hình nằm ở `sr-only`; `title` cho người rê chuột.
 */
export default function LessonVideoBadge({
  label,
  duration,
  className = "",
}: {
  /** Chữ đã dịch, vd. "Có video" / "Has video". */
  label: string;
  /** Thời lượng đã dịch, vd. "34 phút"; bỏ trống khi không biết. Hiện nhỏ, mờ. */
  duration?: string | null;
  className?: string;
}) {
  return (
    <span
      data-testid="lesson-video-badge"
      title={duration ? `${label} · ${duration}` : label}
      className={`inline-flex shrink-0 items-center gap-1 text-faint ${className}`}
    >
      <PlayCircle size={14} aria-hidden className="shrink-0" />
      <span className="sr-only">{label}</span>
      {duration && <span className="text-[11px] tabular-nums">{duration}</span>}
    </span>
  );
}
