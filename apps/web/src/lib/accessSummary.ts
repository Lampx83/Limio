import { formatDate } from "@/lib/datetime";
import { translate, type UiLang } from "@/lib/i18n/core";
import { EN, VI } from "@/lib/i18n/dict";

/**
 * Câu nói rõ hạn truy cập sau khi đổi mã kích hoạt (AC3): "Truy cập đến dd/mm/yyyy." hoặc "Truy cập vĩnh viễn.".
 * `expiresAt` là ISO từ /api/redeem-code; null / thiếu = vĩnh viễn.
 */
export function accessSummary(expiresAt: string | null | undefined, lang: UiLang = "vi"): string {
  if (!expiresAt) return translate(VI, EN, lang, "catalog.access.lifetime");
  return translate(VI, EN, lang, "catalog.access.until", { date: formatDate(expiresAt) });
}
