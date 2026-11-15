import { translate, type UiLang } from "@/lib/i18n/core";
import { EN, VI, type MessageKey } from "@/lib/i18n/dict";

/**
 * Thông báo cho mã lỗi của các API ghi danh — để UI không bao giờ hiện mã thô (`invite_required`, `not_found`…) cho người dùng.
 * Chuỗi nằm ở dict catalog.enrollErr.*; `lang` mặc định "vi" (chỗ gọi cũ không đổi).
 */
const KNOWN_CODES = new Set([
  "unauthorized",
  "not_found",
  "course_not_found",
  "course_not_enrollable",
  "invite_required",
  "invalid_invite_code",
  "payment_required",
  "rate_limited",
  "server_error",
  "network_error",
]);

export function enrollErrorMessage(code: unknown, status?: number, lang: UiLang = "vi"): string {
  const tr = (k: string) => translate(VI, EN, lang, `catalog.enrollErr.${k}` as MessageKey);
  if (typeof code === "string" && KNOWN_CODES.has(code)) return tr(code);
  if (status && status >= 500) return tr("server_error");
  if (status === 403) return tr("forbidden");
  return tr("generic");
}
