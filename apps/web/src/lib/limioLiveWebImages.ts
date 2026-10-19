// Ảnh minh hoạ và link của nguồn internet (bài giảng từ mô tả chủ đề, mức "topic_web"). Module thuần:
// trích ảnh từ chữ markdown của trang nguồn, lọc ảnh, đánh mã ảnh ứng viên cho AI chọn, dựng dòng ghi nguồn và địa chỉ rút gọn.
// Tải và lưu ảnh nằm ở limioLiveWebImagesServer.ts. Tiêu chí: docs/tieu-chi/nguon-web-link-anh.md.

export interface WebImage {
  url: string;
  /**
   * Mô tả ảnh: mô tả Tavily sinh kèm kết quả tìm, hoặc chữ thay thế / chú thích ngay dưới ảnh trên trang nguồn. Là căn
   * cứ để AI chọn ảnh cho slide; ảnh không có mô tả bị bỏ (W6).
   */
  alt: string;
}

/** Ảnh ứng viên tối đa mỗi trang và cả bài (W7). */
export const WEB_IMAGES_PER_PAGE = 3;
export const WEB_IMAGES_TOTAL = 8;
const ALT_MAX = 200;

/** Ảnh thường không phải minh hoạ nội dung: biểu tượng, logo, ảnh đại diện, quảng cáo, điểm theo dõi. */
const JUNK_RE = /(^|[^a-z])(logo|icon|favicon|sprite|avatar|badge|button|emoji|pixel|tracking|spacer|banner|ads?|advert)([^a-z]|$)/i;
const SKIP_EXT_RE = /\.(svg|gif|ico|bmp)(\?|#|$)/i;

const IMG_MD_RE = /!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g;
/** Bản không cờ g của IMG_MD_RE, để .test() không mang lastIndex giữa các lần gọi. */
const IMG_ONE_RE = new RegExp(IMG_MD_RE.source);
const LINK_MD_RE = /\[([^\]]+)\]\(\s*<?[^)\s>]+>?(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g;

const oneLine = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, ALT_MAX);

/**
 * Chuẩn hoá một ảnh ứng viên (W6, W7): địa chỉ tuyệt đối http(s), không phải SVG/GIF/biểu tượng/logo/quảng cáo, có mô tả.
 * Trả null nếu không dùng được.
 */
export function cleanWebImage(rawUrl: string, description: string, base?: string): WebImage | null {
  let url: URL;
  try {
    url = new URL(rawUrl, base);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const href = url.toString();
  const alt = oneLine(description);
  if (!alt || href.length > 2000) return null;
  if (SKIP_EXT_RE.test(url.pathname) || JUNK_RE.test(url.pathname) || JUNK_RE.test(url.hostname) || JUNK_RE.test(alt)) return null;
  return { url: href, alt };
}

/** Dòng chú thích ngay dưới ảnh (trong 2 dòng kế, không phải ảnh khác), bỏ dấu nhấn markdown; dùng khi ảnh thiếu chữ thay thế. */
function captionAfter(markdown: string, from: number): string {
  const lines = markdown.slice(from).split("\n").slice(1, 3);
  const line = lines.find((l) => l.trim())?.trim() ?? "";
  if (!line || IMG_ONE_RE.test(line) || line.length > 220) return "";
  return line.replace(/^[>#\s]+/, "").replace(/[*_`]+/g, "").trim();
}

/** Ảnh trong chữ markdown của một trang (W6, W7): địa chỉ tuyệt đối theo trang, lọc ảnh rác và ảnh không mô tả, bỏ trùng, tối đa 3 ảnh. */
export function extractPageImages(markdown: string, pageUrl: string, max = WEB_IMAGES_PER_PAGE): WebImage[] {
  const out: WebImage[] = [];
  const seen = new Set<string>();
  for (const m of [...markdown.matchAll(IMG_MD_RE)]) {
    const img = cleanWebImage(m[2]!, m[1]!.trim() || captionAfter(markdown, m.index!), pageUrl);
    if (!img || seen.has(img.url)) continue;
    seen.add(img.url);
    out.push(img);
    if (out.length >= max) break;
  }
  return out;
}

/** Chữ của trang đưa cho AI: bỏ ảnh, link chỉ giữ chữ (ảnh đã được tách riêng theo trang). */
export function stripMarkdownMedia(markdown: string): string {
  return markdown
    .replace(IMG_MD_RE, "")
    .replace(LINK_MD_RE, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([.,;:!?])/g, "$1");
}

/** Lọc danh sách ảnh đã lưu (cột LiveDeck.sourceRefs): chỉ http(s), chữ thay thế gọn. */
export function sanitizeWebImages(raw: unknown, max = WEB_IMAGES_PER_PAGE): WebImage[] {
  return (Array.isArray(raw) ? raw : [])
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
    .map((r) => ({ url: typeof r.url === "string" ? r.url.slice(0, 2000) : "", alt: typeof r.alt === "string" ? r.alt.slice(0, ALT_MAX) : "" }))
    .filter((r) => /^https?:\/\//i.test(r.url))
    .slice(0, max);
}

interface RefWithImages {
  n: number;
  title: string;
  url: string;
  images?: WebImage[];
}

/**
 * Ảnh ứng viên cho AI chọn (W8): mã A1, A2… theo thứ tự trang rồi ảnh, tối đa 8 ảnh cả bài. Cùng một danh sách refs luôn
 * ra cùng các mã, nên lời dặn AI (lúc viết slide) và bước gắn ảnh (sau đó) khớp nhau.
 */
export function webImageCandidates<R extends RefWithImages>(refs: R[]): Array<{ id: string; image: WebImage; ref: R }> {
  return refs
    .flatMap((ref) => (ref.images ?? []).map((image) => ({ ref, image })))
    .slice(0, WEB_IMAGES_TOTAL)
    .map((c, k) => ({ id: `A${k + 1}`, ...c }));
}

/** Đúng dạng mã ảnh ứng viên (A1…A99); mã có thật hay không do bước gắn ảnh kiểm. */
export const isWebImageId = (v: unknown): v is string => typeof v === "string" && /^A[1-9]\d?$/.test(v);

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

/**
 * Dòng ghi nguồn dưới ảnh (W10): "Tên trang (tên miền)", vừa trần 120 ký tự của imageCredit. Phần vẽ slide tự thêm
 * "Nguồn ảnh:" phía trước và nối link tới trang nguồn (imageSourceUrl).
 */
export function imageCredit(ref: { title: string; url: string; n?: number }, max = 120): string {
  const h = host(ref.url);
  const tail = h ? ` (${h})` : "";
  const room = max - tail.length;
  const title = (ref.title || h).trim();
  const t = title.length > room ? `${title.slice(0, Math.max(0, room - 1)).trimEnd()}…` : title;
  return `${t}${tail}`;
}

/** Địa chỉ rút gọn ở dòng phụ của slide Nguồn tham khảo (W1): bỏ giao thức và www, giải mã tiếng Việt, cắt bớt khi dài. */
export function shortUrl(url: string, max = 56): string {
  let s: string;
  try {
    const u = new URL(url);
    let path = u.pathname;
    try {
      path = decodeURIComponent(path);
    } catch {
      // Đường dẫn mã hoá hỏng: giữ nguyên.
    }
    s = `${u.hostname.replace(/^www\./, "")}${path === "/" ? "" : path.replace(/\/$/, "")}${u.search}`;
  } catch {
    s = url;
  }
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
