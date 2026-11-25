import { formatDate } from "@/lib/datetime";

/** Còn từng này ngày trở xuống thì cảnh báo "sắp hết hạn" (cùng ngưỡng nhắc qua email nên không mâu thuẫn). */
export const ACCESS_SOON_DAYS = 30;

export type AccessExpiryInfo =
  | { kind: "lifetime" }
  | { kind: "until"; dateText: string; daysLeft: number; soon: boolean };

const DAY_MS = 24 * 3600 * 1000;

/**
 * Hạn truy cập của một ghi danh để hiện cho học viên (docs/tieu-chi/trang-thanh-toan.md, AC5). null = không giới hạn.
 * `daysLeft` làm tròn LÊN (còn 0,2 ngày vẫn là "còn 1 ngày"), tối thiểu 0; hạn đã qua cho 0 ngày.
 */
export function accessExpiryInfo(expiresAt: Date | string | null | undefined, now: Date = new Date()): AccessExpiryInfo {
  if (!expiresAt) return { kind: "lifetime" };
  const at = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  const daysLeft = Math.max(0, Math.ceil((at.getTime() - now.getTime()) / DAY_MS));
  return { kind: "until", dateText: formatDate(at), daysLeft, soon: daysLeft <= ACCESS_SOON_DAYS };
}
