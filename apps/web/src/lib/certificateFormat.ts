// Hàm định dạng dùng chung cho chứng nhận: bản PDF (certificatePdf.tsx) và bản
// xem trước HTML (app/learn/[slug]/certificate) — để hai bên không lệch nhau.

/** Chèn khoảng trắng thật giữa từng ký tự (chữ cách tay) — xem ghi chú ở `styles.kicker` của certificatePdf.tsx. */
export function tracked(s: string): string {
  return s.split("").join(" ");
}

/** "7 giờ 34 phút" — null nếu học dưới 1 phút. */
export function formatDuration(
  totalSec: number,
  t: { hours: string; minutes: string },
): string | null {
  if (totalSec < 60) return null;
  const h = Math.floor(totalSec / 3600);
  const m = Math.round((totalSec % 3600) / 60);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} ${t.hours}`);
  if (m > 0) parts.push(`${m} ${t.minutes}`);
  return parts.join(" ") || null;
}
