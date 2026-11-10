/**
 * Tên miền riêng của Limio Language (biến môi trường LANGUAGE_HOST, tuỳ chọn). Chỉ dùng ở edge middleware nên toàn hàm
 * thuần. Không còn chế độ giao diện/cookie: tên miền riêng chỉ viết lại "/" thành trang giới thiệu `/language`
 * (docs/tieu-chi/limio-language-gop-menu.md, AC4).
 */

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

/** "/" của tên miền riêng được viết lại thành /language; mọi đường dẫn khác giữ nguyên. */
export function languageHostRewrite(o: { host?: string | null; languageHost?: string | null; pathname: string }): string | null {
  return o.pathname === "/" && hostMatches(o.host, o.languageHost) ? "/language" : null;
}
