/**
 * LANG L1 — "chế độ ứng dụng" của vỏ Limio Language (mức A: cùng ứng dụng, vỏ giao diện riêng).
 *
 * Chế độ CHỈ đổi vỏ (header + menu + trang chủ): mọi URL, quyền, dữ liệu giữ nguyên. Cookie này không cấp
 * quyền nào — giả cookie chỉ làm người đó thấy vỏ ngoại ngữ cho những trang họ vốn vào được.
 *
 * Chỉ người dùng CHỦ ĐỘNG mới đổi chế độ (vào /language, tên miền riêng, hoặc nút chuyển); mở một khoá ngoại
 * ngữ KHÔNG tự đổi vỏ. Toàn hàm thuần để dùng được cả ở edge middleware.
 */

export const APP_MODE_COOKIE = "limio_app";
export type AppMode = "default" | "language";

/** Tên miền bỏ cổng/dấu chấm cuối, chữ thường. */
function normalizeHost(h: string): string {
  return h.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
}

/** Khớp tên miền riêng (LANGUAGE_HOST). Không đặt biến ⇒ không bao giờ khớp. */
export function hostMatches(host: string | null | undefined, languageHost: string | null | undefined): boolean {
  if (!host || !languageHost) return false;
  const lh = normalizeHost(languageHost);
  return lh !== "" && normalizeHost(host) === lh;
}

export function resolveAppMode(o: { cookie?: string | null; host?: string | null; languageHost?: string | null }): AppMode {
  if (hostMatches(o.host, o.languageHost)) return "language";
  return o.cookie === "language" ? "language" : "default";
}

/** Chỉ nhận đường dẫn nội bộ (một dấu "/" đầu, không scheme, không ký tự điều khiển) — chống open redirect. */
export function safeNextPath(next: string | null | undefined, fallback: string): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(next)) return fallback;
  if (/%0[0-9a-f]|%1[0-9a-f]|%7f|%5c/i.test(next)) return fallback;
  return next;
}

/** Đường dẫn (CHƯA có basePath — bọc `apiUrl()` khi dùng ở trình duyệt) tới route đổi chế độ. */
export function appModeSwitchPath(to: AppMode, next?: string): string {
  return `/api/app-mode?to=${to}${next ? `&next=${encodeURIComponent(next)}` : ""}`;
}

/**
 * Middleware: có cần đặt chế độ / viết lại đường dẫn không.
 *  - vào /language[/...] ⇒ đặt chế độ language;
 *  - tên miền riêng ⇒ luôn đặt chế độ language, và "/" được viết lại thành /language.
 */
export function languageEntryRouting(o: {
  host?: string | null;
  languageHost?: string | null;
  pathname: string;
}): { rewriteTo?: string; setMode: "language" } | null {
  const onLanguageHost = hostMatches(o.host, o.languageHost);
  if (onLanguageHost) {
    return o.pathname === "/" ? { rewriteTo: "/language", setMode: "language" } : { setMode: "language" };
  }
  if (o.pathname === "/language" || o.pathname.startsWith("/language/")) return { setMode: "language" };
  return null;
}
