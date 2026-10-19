// Ảnh minh hoạ và link của nguồn internet (bài giảng từ mô tả chủ đề, mức "topic_web"). Module thuần:
// trích ảnh từ chữ markdown của trang nguồn, lọc ảnh, chọn ảnh cho slide Chữ và hình, dựng dòng ghi nguồn và địa chỉ rút gọn.
// Tải và lưu ảnh nằm ở limioLiveWebImagesServer.ts. Tiêu chí: docs/tieu-chi/nguon-web-link-anh.md.

export interface WebImage {
  url: string;
  /** Chữ thay thế của ảnh trên trang nguồn: căn cứ để chọn ảnh hợp với slide. */
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
const LINK_MD_RE = /\[([^\]]+)\]\(\s*<?[^)\s>]+>?(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g;

/** Ảnh trong chữ markdown của một trang (W6, W7): địa chỉ tuyệt đối theo trang, lọc ảnh rác, bỏ trùng, tối đa 3 ảnh. */
export function extractPageImages(markdown: string, pageUrl: string, max = WEB_IMAGES_PER_PAGE): WebImage[] {
  const out: WebImage[] = [];
  const seen = new Set<string>();
  for (const m of markdown.matchAll(IMG_MD_RE)) {
    let url: URL;
    try {
      url = new URL(m[2]!, pageUrl);
    } catch {
      continue;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") continue;
    const href = url.toString();
    const alt = m[1]!.replace(/\s+/g, " ").trim().slice(0, ALT_MAX);
    if (SKIP_EXT_RE.test(url.pathname) || JUNK_RE.test(url.pathname) || JUNK_RE.test(url.hostname) || JUNK_RE.test(alt)) continue;
    if (seen.has(href) || href.length > 2000) continue;
    seen.add(href);
    out.push({ url: href, alt });
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

const STOP = new Set(
  "của và là các cho có được một những với trong này thì không người học bài slide như khi để từ theo về đã sẽ đang cũng hay hoặc nào gì the a an of and to in for on with is are".split(
    " ",
  ),
);
const terms = (s: string) => new Set(s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2 && !STOP.has(w)));

export interface ImageSlideInput {
  /** Vị trí slide trong danh sách đang tạo. */
  index: number;
  layout: string;
  /** Tiêu đề và ý chính của slide, nối lại. */
  text: string;
  /** Slide đã có ảnh riêng (giảng viên chọn hay lần tạo trước): không thay. */
  hasImage: boolean;
}

interface RefWithImages {
  n: number;
  title: string;
  url: string;
  images?: WebImage[];
}

/**
 * Chọn ảnh nguồn cho slide Chữ và hình (W8): điểm = số từ chung giữa chữ thay thế của ảnh và chữ của slide; ghép tham lam từ
 * cặp điểm cao nhất, mỗi ảnh và mỗi slide một lần; cần ít nhất 2 từ chung để tránh ảnh lạc đề. Không đặt ảnh lên bìa, bìa phần.
 */
export function pickSlideImages<R extends RefWithImages>(slides: ImageSlideInput[], refs: R[]): Array<{ index: number; image: WebImage; ref: R }> {
  const candidates = refs.flatMap((ref) => (ref.images ?? []).map((image) => ({ ref, image, t: terms(image.alt) }))).slice(0, WEB_IMAGES_TOTAL);
  const pairs: Array<{ index: number; c: number; score: number }> = [];
  for (const s of slides) {
    if (s.layout !== "image" || s.hasImage) continue;
    const st = terms(s.text);
    candidates.forEach((cand, c) => {
      let score = 0;
      for (const w of cand.t) if (st.has(w)) score += 1;
      if (score >= 2) pairs.push({ index: s.index, c, score });
    });
  }
  pairs.sort((a, b) => b.score - a.score || a.index - b.index || a.c - b.c);
  const usedSlide = new Set<number>();
  const usedImage = new Set<number>();
  const out: Array<{ index: number; image: WebImage; ref: R }> = [];
  for (const p of pairs) {
    if (usedSlide.has(p.index) || usedImage.has(p.c)) continue;
    usedSlide.add(p.index);
    usedImage.add(p.c);
    out.push({ index: p.index, image: candidates[p.c]!.image, ref: candidates[p.c]!.ref });
  }
  return out.sort((a, b) => a.index - b.index);
}

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
