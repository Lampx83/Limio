/**
 * Hình mascot chanh cho badge — file SVG ở `public/badges/`, map theo `Badge.code`.
 * Thêm badge milestone mới: vẽ `<tên>.svg` rồi thêm 1 dòng vào BY_CODE; chưa
 * có hình thì rơi về `default.svg` (không lỗi, không ô trống).
 * Badge kỹ năng (`skill_master:<skillCode>`, sinh động theo skill) dùng chung 1 hình.
 */
const BY_CODE: Record<string, string> = {
  first_step: "first_step",
  quiz_starter: "quiz_starter",
  first_win: "first_win",
  perfect_score: "perfect_score",
  course_complete: "course_complete",
};

export function badgeImageFor(code: string): string {
  const file = BY_CODE[code] ?? (code.startsWith("skill_master:") ? "skill_master" : "default");
  return `/badges/${file}.svg`;
}

export default function BadgeIcon({
  code,
  className = "h-8 w-8",
}: {
  code: string;
  /** Kích thước + hiệu ứng (vd. "grayscale opacity-50" cho badge chưa mở khoá). */
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- SVG tĩnh nhỏ, không cần tối ưu ảnh
    <img src={badgeImageFor(code)} alt="" aria-hidden className={`shrink-0 ${className}`} draggable={false} />
  );
}
