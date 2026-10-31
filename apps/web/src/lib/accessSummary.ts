import { formatDate } from "@/lib/datetime";

/**
 * Câu nói rõ hạn truy cập sau khi đổi mã kích hoạt (AC3): "Truy cập đến dd/mm/yyyy." hoặc "Truy cập vĩnh viễn.".
 * `expiresAt` là ISO từ /api/redeem-code; null / thiếu = vĩnh viễn.
 */
export function accessSummary(expiresAt: string | null | undefined): string {
  if (!expiresAt) return "Truy cập vĩnh viễn.";
  return `Truy cập đến ${formatDate(expiresAt)}.`;
}
