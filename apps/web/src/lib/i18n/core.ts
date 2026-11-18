/**
 * Lõi i18n giao diện (thuần, dùng được cả server lẫn client).
 *
 * Hai ngôn ngữ: "vi" (mặc định, nguồn sự thật — mọi chuỗi gốc nằm ở dict/vi/*) và "en". Chuỗi chưa dịch sang "en"
 * RƠI VỀ tiếng Việt, không bao giờ hiện khoá thô. Nhờ vậy dịch dần được mà không làm vỡ trang nào.
 *
 * Chọn ngôn ngữ: lựa chọn tay (cookie `fbm-lang`) luôn thắng; không có thì theo `course.language` của khoá đang xem
 * ("en" ⇒ giao diện en); còn lại là "vi".
 */

export type UiLang = "vi" | "en";
export const UI_LANGS: readonly UiLang[] = ["vi", "en"];
export const DEFAULT_UI_LANG: UiLang = "vi";
export const LANG_COOKIE = "fbm-lang";
/** Một năm — lựa chọn ngôn ngữ là tuỳ chọn lâu dài, không phải phiên. */
export const LANG_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function parseUiLang(raw: string | null | undefined): UiLang | null {
  return raw === "en" || raw === "vi" ? raw : null;
}

/** Ngôn ngữ giao diện cho một khoá: chỉ "en" mới đổi sang giao diện en; mọi giá trị khác (vi, rỗng, mã lạ) là vi. */
export function uiLangForCourse(courseLanguage: string | null | undefined): UiLang {
  return courseLanguage?.trim().toLowerCase().split(/[-_]/)[0] === "en" ? "en" : "vi";
}

/** Lựa chọn tay (cookie hợp lệ) thắng; nếu không thì theo khoá; nếu không có khoá thì mặc định. */
export function resolveUiLang(opts: { cookie?: string | null; courseLanguage?: string | null }): UiLang {
  const chosen = parseUiLang(opts.cookie);
  if (chosen) return chosen;
  if (opts.courseLanguage != null) return uiLangForCourse(opts.courseLanguage);
  return DEFAULT_UI_LANG;
}

/** Đường dẫn trang của một khoá: /catalog/<slug> hoặc /learn/<slug>… (đã bỏ basePath). */
const COURSE_PAGE_RE = /^\/(?:catalog|learn)\/([^/?#]+)/;

/**
 * Slug khoá của trang đã gọi một request API, lấy từ `Referer` cùng nguồn. Request API không có đường dẫn khoá, nên trước đây lời nhận xét AI
 * và các chuỗi do máy chủ dựng rơi về tiếng Việt trong khi trang (đã chọn giao diện theo `course.language`) hiện tiếng Anh, hoặc ngược lại.
 * Chỉ nhận Referer cùng `host`; giá trị chỉ dùng để chọn ngôn ngữ nên không cần tin cậy hơn thế.
 */
export function courseSlugFromReferer(referer: string | null | undefined, host: string | null | undefined, basePath = ""): string | null {
  if (!referer || !host) return null;
  let url: URL;
  try {
    url = new URL(referer);
  } catch {
    return null;
  }
  if (url.host !== host) return null;
  let path = url.pathname;
  if (basePath && path.startsWith(basePath)) path = path.slice(basePath.length) || "/";
  const slug = COURSE_PAGE_RE.exec(path)?.[1];
  if (!slug) return null;
  try {
    return decodeURIComponent(slug);
  } catch {
    return null;
  }
}

export type Dict = Record<string, string>;
export type PartialDict<T extends Dict> = Partial<Record<keyof T, string>>;
export type TParams = Record<string, string | number>;

function interpolate(s: string, params?: TParams): string {
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

/**
 * Dịch một khoá. `vi` là từ điển gốc (đủ khoá), `en` có thể thiếu khoá. Thiếu ở en ⇒ lấy vi; thiếu cả hai (khoá gõ sai
 * lọt qua type) ⇒ trả lại chính khoá, vì thà thấy một chuỗi lạ còn hơn trang trắng.
 */
export function translate<K extends string>(
  vi: Record<K, string>,
  en: Partial<Record<K, string>>,
  lang: UiLang,
  key: K,
  params?: TParams,
): string {
  const raw = (lang === "en" ? en[key] : undefined) ?? vi[key] ?? key;
  return interpolate(raw, params);
}
