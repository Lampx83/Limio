// Bố cục slide "Nội dung" của Limio-Live. Module thuần (không React, không DB) để
// dùng chung cho trình soạn, trình chiếu, ảnh thu nhỏ và bộ test.
//
// Nguyên tắc: slide lưu theo TRƯỜNG có cấu trúc (tiêu đề, thẻ, bước...), còn hình
// thức (cỡ chữ, màu, bố cục) do bố cục + giao diện tự vẽ. Nhờ vậy sửa chữ không
// làm vỡ hình thức, và đổi bố cục không mất nội dung.

import { isMotifChoice } from "./limioLiveMotifs";

export const SLIDE_LAYOUTS = [
  "classic", // slide cũ: tiêu đề + phụ đề + ý chính + ảnh (mọi bài giảng có sẵn)
  "cover",
  "section",
  "image",
  "cards",
  "compare",
  "steps",
  "stats",
  "quote",
  "summary",
] as const;
export type SlideLayoutId = (typeof SLIDE_LAYOUTS)[number];

export const LAYOUT_META: Record<SlideLayoutId, { label: string; hint: string }> = {
  classic: { label: "Chữ và ảnh (cũ)", hint: "Tiêu đề, ý chính và ảnh minh hoạ như trước" },
  cover: { label: "Bìa", hint: "Slide đầu: tên đơn vị, tên bài, phụ đề, người trình bày" },
  section: { label: "Tiêu đề mục", hint: "Mở đầu mỗi phần lớn của bài" },
  image: { label: "Chữ và hình", hint: "Ba ý chính kèm hình minh hoạ" },
  cards: { label: "Ba thẻ", hint: "Các ý song song, mỗi ý một biểu tượng" },
  compare: { label: "So sánh hai cột", hint: "Đối chiếu hai cách làm" },
  steps: { label: "Các bước", hint: "Quy trình hoặc dòng thời gian" },
  stats: { label: "Số liệu", hint: "Con số lớn kèm câu giải thích" },
  quote: { label: "Trích dẫn", hint: "Một ý chính cần nhấn mạnh" },
  summary: { label: "Tóm tắt", hint: "Slide cuối: các điều cần ghi nhớ" },
};

export const SLIDE_ICONS = ["target", "compass", "route", "chat", "book", "sparkle", "users", "chart"] as const;
export type SlideIconId = (typeof SLIDE_ICONS)[number];

export interface LayoutItem {
  heading: string; // tiêu đề thẻ / tên bước / con số / nội dung dòng tóm tắt
  body: string; // câu giải thích (không dùng ở slide tóm tắt)
  icon?: SlideIconId; // chỉ dùng ở slide ba thẻ
}

export interface LayoutColumn {
  heading: string;
  points: string[];
  note: string;
  tone: "bad" | "good";
}

/** Số mục cho phép của từng bố cục có danh sách. */
export const ITEM_RANGE: Partial<Record<SlideLayoutId, { min: number; max: number }>> = {
  cards: { min: 2, max: 4 },
  steps: { min: 2, max: 5 },
  stats: { min: 2, max: 4 },
  summary: { min: 2, max: 5 },
};

/**
 * Kiểu bìa: cùng bốn dòng chữ (đơn vị, tên bài, phụ đề, người trình bày), khác nhau ở bố cục và vùng trang trí.
 * Mỗi kiểu dành riêng một vùng không có chữ cho hoa văn của bài giảng (limioLiveMotifs). Bản mẫu đã duyệt:
 * docs/mockup/bia-bai-giang.html. Lưu ở `config.coverStyle` như một khoá meta (xem pickMeta).
 */
export const COVER_STYLES = ["block", "formal", "arch", "band", "arc", "tiles", "tape", "wave", "pillar", "bubbles"] as const;
export type CoverStyleId = (typeof COVER_STYLES)[number];
export const DEFAULT_COVER_STYLE: CoverStyleId = "block";
export const COVER_STYLE_LABELS: Record<CoverStyleId, string> = {
  block: "Khối màu",
  formal: "Trang trọng",
  arch: "Vòm",
  band: "Dải màu",
  arc: "Vòng cung",
  tiles: "Ô ghép",
  tape: "Dán giấy",
  wave: "Sóng",
  pillar: "Cột hoa văn",
  bubbles: "Bong bóng",
};
export const isCoverStyle = (v: unknown): v is CoverStyleId => typeof v === "string" && (COVER_STYLES as readonly string[]).includes(v);
/** Kiểu bìa của một slide; chưa chọn hoặc giá trị lạ thì dùng kiểu mặc định. */
export const resolveCoverStyle = (config: unknown): CoverStyleId => {
  const v = (config as { coverStyle?: unknown } | null | undefined)?.coverStyle;
  return isCoverStyle(v) ? v : DEFAULT_COVER_STYLE;
};

/** Số phần tối đa trên mục lục của bìa phần (vừa khung 720 px với chữ ≥ 26 px). */
export const MAX_TOC = 6;

/** Số ý chính tối đa của slide chữ và hình. */
export const MAX_BULLETS: Partial<Record<SlideLayoutId, number>> = { image: 3, classic: 3 };

/** Giới hạn độ dài từng trường (ký tự). Cắt ở máy chủ; trình soạn hiện cảnh báo trước khi chạm trần. */
export const MAX_LEN = {
  title: 120,
  subtitle: 200,
  org: 120,
  byline: 80,
  sectionNumber: 4,
  tocItem: 80,
  bullet: 140,
  itemHeading: 60,
  itemBody: 140,
  statValue: 10,
  columnHeading: 40,
  columnPoint: 140,
  columnNote: 140,
  footnote: 80,
  quote: 200,
  source: 80,
  notes: 2000,
} as const;

/** Cỡ chữ nhỏ nhất trên khung thiết kế 1280×720 (tương đương 39 px ở màn 1920×1080). */
export const MIN_FONT_PX = 26;

export function resolveLayout(config: unknown): SlideLayoutId {
  const l = (config as { layout?: unknown } | null | undefined)?.layout;
  return typeof l === "string" && (SLIDE_LAYOUTS as readonly string[]).includes(l) ? (l as SlideLayoutId) : "classic";
}

const clip = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");

function sanitizeItems(raw: unknown, layout: SlideLayoutId): LayoutItem[] {
  const range = ITEM_RANGE[layout];
  if (!range || !Array.isArray(raw)) return [];
  const items: LayoutItem[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const isStat = layout === "stats";
    const heading = clip(o.heading, isStat ? MAX_LEN.statValue : MAX_LEN.itemHeading);
    const body = layout === "summary" ? "" : clip(o.body, MAX_LEN.itemBody);
    if (!heading && !body) continue;
    const icon =
      layout === "cards" && typeof o.icon === "string" && (SLIDE_ICONS as readonly string[]).includes(o.icon)
        ? (o.icon as SlideIconId)
        : undefined;
    items.push({ heading, body, ...(icon ? { icon } : {}) });
    if (items.length >= range.max) break;
  }
  return items;
}

function sanitizeColumns(raw: unknown): LayoutColumn[] {
  if (!Array.isArray(raw)) return [];
  const cols: LayoutColumn[] = [];
  for (const r of raw.slice(0, 2)) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    cols.push({
      heading: clip(o.heading, MAX_LEN.columnHeading),
      points: (Array.isArray(o.points) ? o.points : [])
        .map((p) => clip(p, MAX_LEN.columnPoint))
        .filter(Boolean)
        .slice(0, 3),
      note: clip(o.note, MAX_LEN.columnNote),
      tone: o.tone === "bad" ? "bad" : "good",
    });
  }
  return cols;
}

/**
 * Chuẩn hoá config của slide có bố cục mới: chỉ giữ các trường bố cục dùng, cắt độ
 * dài, bỏ mục rỗng. Các khoá không thuộc bố cục (vd. ghi chú giảng `presenterNote`,
 * hẹn giờ) do nơi gọi giữ riêng. Bố cục "classic" không đi qua hàm này.
 */
export function sanitizeLayoutConfig(layout: SlideLayoutId, raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { layout };
  const title = clip(raw.title, MAX_LEN.title);
  if (title) out.title = title;
  const subtitle = clip(raw.subtitle, MAX_LEN.subtitle);
  if (subtitle && (layout === "cover" || layout === "section")) out.subtitle = subtitle;
  if (layout === "cover") {
    const org = clip(raw.org, MAX_LEN.org);
    if (org) out.org = org;
    const byline = clip(raw.byline, MAX_LEN.byline);
    if (byline) out.byline = byline;
  }
  if (layout === "section") {
    const n = clip(raw.sectionNumber, MAX_LEN.sectionNumber);
    if (n) out.sectionNumber = n;
    // Mục lục của bìa phần: tên các phần Nội dung, do hệ thống tính từ dàn ý (không do AI viết).
    const toc = (Array.isArray(raw.toc) ? raw.toc : []).map((t) => clip(t, MAX_LEN.tocItem)).filter(Boolean).slice(0, MAX_TOC);
    const cur = Number(raw.tocCurrent);
    if (toc.length >= 2 && Number.isInteger(cur) && cur >= 1 && cur <= toc.length) {
      out.toc = toc;
      out.tocCurrent = cur;
    }
  }
  if (layout === "image") {
    const bullets = (Array.isArray(raw.bullets) ? raw.bullets : [])
      .map((b) => clip(b, MAX_LEN.bullet))
      .filter(Boolean)
      .slice(0, MAX_BULLETS.image);
    if (bullets.length) out.bullets = bullets;
    const img = clip(raw.imageUrl, 2000);
    if (img) out.imageUrl = img;
  }
  if (ITEM_RANGE[layout]) out.items = sanitizeItems(raw.items, layout);
  if (layout === "steps") {
    const f = clip(raw.footnote, MAX_LEN.footnote);
    if (f) out.footnote = f;
  }
  if (layout === "compare") out.columns = sanitizeColumns(raw.columns);
  if (layout === "quote") {
    const q = clip(raw.quote, MAX_LEN.quote);
    if (q) out.quote = q;
    const s = clip(raw.source, MAX_LEN.source);
    if (s) out.source = s;
    delete out.title;
  }
  return out;
}

/** Nội dung trống để giảng viên bắt đầu điền khi chọn một bố cục. */
export function emptyLayoutConfig(layout: SlideLayoutId): Record<string, unknown> {
  const blank = (n: number): LayoutItem[] => Array.from({ length: n }, () => ({ heading: "", body: "" }));
  switch (layout) {
    case "cover":
      return { layout, org: "", title: "", subtitle: "", byline: "" };
    case "section":
      return { layout, sectionNumber: "01", title: "", subtitle: "" };
    case "image":
      return { layout, title: "", bullets: ["", "", ""] };
    case "cards":
      return {
        layout,
        title: "",
        items: [
          { heading: "", body: "", icon: "target" },
          { heading: "", body: "", icon: "compass" },
          { heading: "", body: "", icon: "route" },
        ],
      };
    case "compare":
      return {
        layout,
        title: "",
        columns: [
          { heading: "", points: [""], note: "", tone: "bad" },
          { heading: "", points: [""], note: "", tone: "good" },
        ],
      };
    case "steps":
      return { layout, title: "", items: blank(4), footnote: "" };
    case "stats":
      return { layout, title: "", items: blank(3) };
    case "quote":
      return { layout, quote: "", source: "" };
    case "summary":
      return { layout, title: "", items: blank(3) };
    default:
      return { title: "", subtitle: "", bullets: [] };
  }
}

/**
 * Tách tiêu đề thành phần thường + phần nhấn (nhóm từ cuối, chữ chuyển màu).
 * Chỉ nhấn khi tiêu đề từ 4 từ trở lên để tiêu đề ngắn không bị chia vụn.
 */
export function accentTail(title: string): { head: string; tail: string } {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length < 4) return { head: words.join(" "), tail: "" };
  const n = Math.ceil(words.length / 3);
  return { head: words.slice(0, words.length - n).join(" "), tail: words.slice(words.length - n).join(" ") };
}

/**
 * Ước lượng cỡ chữ lớn nhất (≤ maxPx) để đoạn chữ vừa `maxLines` dòng trong khung
 * rộng `widthPx`, nhưng không nhỏ hơn `minPx`. Dùng hệ số 0,56 em cho độ rộng ký tự
 * (font Be Vietnam Pro rộng hơn phần lớn font hệ thống). `overflow` = true khi đã
 * xuống đáy mà vẫn không vừa — lúc đó trình soạn gợi ý tách slide.
 */
export function fitFontSize(
  text: string,
  o: { maxPx: number; minPx?: number; widthPx: number; maxLines: number },
): { px: number; overflow: boolean } {
  const minPx = Math.max(o.minPx ?? MIN_FONT_PX, MIN_FONT_PX);
  const len = text.trim().length;
  if (len === 0) return { px: o.maxPx, overflow: false };
  for (let px = o.maxPx; px >= minPx; px -= 2) {
    const perLine = Math.max(1, Math.floor(o.widthPx / (px * 0.56)));
    if (Math.ceil(len / perLine) <= o.maxLines) return { px, overflow: false };
  }
  return { px: minPx, overflow: true };
}

/** Các trường chữ của slide, kèm khung chứa ước lượng; dùng để cảnh báo "Slide này dài". */
export function layoutTextProblems(layout: SlideLayoutId, c: Record<string, any>): string[] {
  const problems: string[] = [];
  const check = (label: string, text: unknown, o: Parameters<typeof fitFontSize>[1]) => {
    if (typeof text === "string" && text && fitFontSize(stripInline(text), o).overflow) problems.push(label);
  };
  const items: LayoutItem[] = Array.isArray(c.items) ? c.items : [];
  switch (layout) {
    case "cards":
      items.forEach((it, i) => check(`Thẻ ${i + 1}`, it.body, { maxPx: 30, widthPx: 290, maxLines: 4 }));
      break;
    case "steps":
      items.forEach((it, i) => check(`Bước ${i + 1}`, it.body, { maxPx: 28, widthPx: 240, maxLines: 4 }));
      break;
    case "stats":
      items.forEach((it, i) => check(`Số liệu ${i + 1}`, it.body, { maxPx: 32, widthPx: 300, maxLines: 4 }));
      break;
    case "summary":
      items.forEach((it, i) => check(`Dòng ${i + 1}`, it.heading, { maxPx: 40, widthPx: 880, maxLines: 2 }));
      break;
    case "image":
      (Array.isArray(c.bullets) ? c.bullets : []).forEach((b: string, i: number) =>
        check(`Ý ${i + 1}`, b, { maxPx: 38, widthPx: 560, maxLines: 3 }),
      );
      break;
    case "quote":
      check("Câu trích dẫn", c.quote, { maxPx: 66, widthPx: 1000, maxLines: 4 });
      break;
    case "compare":
      (Array.isArray(c.columns) ? c.columns : []).forEach((col: LayoutColumn, i: number) =>
        col.points.forEach((p) => check(`Cột ${i + 1}`, p, { maxPx: 32, widthPx: 480, maxLines: 3 })),
      );
      break;
    default:
      break;
  }
  check("Tiêu đề", c.title, { maxPx: 72, widthPx: 1088, maxLines: 2 });
  return Array.from(new Set(problems));
}

// ── Đổi bố cục mà không mất nội dung ───────────────────────────────────────

const joinSentence = (a: string, b: string): string => {
  const h = a.trim();
  const t = b.trim();
  if (!h) return t;
  if (!t) return h;
  return /[.!?…:;]$/.test(h) ? `${h} ${t}` : `${h}. ${t}`;
};

type Pieces = { title: string; subtitle: string; texts: Array<{ heading: string; body: string }>; imageUrl: string };

/** Gom nội dung của mọi bố cục về các mảnh chung: tiêu đề, phụ đề, danh sách ý, ảnh. */
function toPieces(c: Record<string, any>): Pieces {
  const layout = resolveLayout(c);
  const texts: Pieces["texts"] = [];
  if (Array.isArray(c.items)) for (const it of c.items) texts.push({ heading: String(it?.heading ?? ""), body: String(it?.body ?? "") });
  if (Array.isArray(c.bullets)) for (const b of c.bullets) texts.push({ heading: String(b ?? ""), body: "" });
  if (Array.isArray(c.columns)) {
    for (const col of c.columns) {
      const points: string[] = Array.isArray(col?.points) ? col.points : [];
      texts.push({ heading: String(col?.heading ?? ""), body: [...points, col?.note ?? ""].filter(Boolean).join(" ") });
    }
  }
  const title = String(c.title ?? c.quote ?? "");
  const subtitle = String(c.subtitle ?? (layout === "quote" ? c.source ?? "" : "") ?? "");
  return { title, subtitle, texts: texts.filter((t) => t.heading.trim() || t.body.trim()), imageUrl: String(c.imageUrl ?? "") };
}

/**
 * Chuyển nội dung sang bố cục khác: tiêu đề, phụ đề, các ý và ảnh được mang theo; trường mà
 * bố cục đích không có thì gộp vào trường gần nghĩa nhất (vd. ý của thẻ gộp thành một câu khi
 * sang danh sách ý). Kết quả đã qua sanitizeLayoutConfig.
 */
export function convertLayoutConfig(from: Record<string, any>, to: SlideLayoutId): Record<string, unknown> {
  if (to === "classic") {
    const p = toPieces(from);
    return {
      title: p.title,
      subtitle: p.subtitle,
      bullets: p.texts.map((t) => joinSentence(t.heading, t.body)).slice(0, MAX_BULLETS.classic),
      ...(p.imageUrl ? { imageUrl: p.imageUrl } : {}),
    };
  }
  const p = toPieces(from);
  const base: Record<string, unknown> = emptyLayoutConfig(to);
  switch (to) {
    case "cover":
      base.title = p.title;
      base.subtitle = p.subtitle || p.texts.map((t) => joinSentence(t.heading, t.body))[0] || "";
      break;
    case "section":
      base.title = p.title;
      base.subtitle = p.subtitle;
      break;
    case "image":
      base.title = p.title;
      base.bullets = p.texts.map((t) => joinSentence(t.heading, t.body)).slice(0, MAX_BULLETS.image);
      if (p.imageUrl) base.imageUrl = p.imageUrl;
      break;
    case "cards":
    case "steps":
    case "stats":
    case "summary": {
      base.title = p.title;
      const range = ITEM_RANGE[to]!;
      const base_items = emptyLayoutConfig(to).items as LayoutItem[];
      const fromTexts = p.texts.slice(0, range.max);
      const n = Math.max(fromTexts.length, base_items.length);
      base.items = Array.from({ length: n }, (_, i) => ({
        ...(base_items[i] ?? { heading: "", body: "" }),
        heading: fromTexts[i]?.heading ?? "",
        body: to === "summary" ? "" : fromTexts[i]?.body ?? "",
        ...(to === "summary" && fromTexts[i]?.body ? { heading: joinSentence(fromTexts[i]!.heading, fromTexts[i]!.body) } : {}),
      }));
      break;
    }
    case "compare": {
      base.title = p.title;
      const cols = base.columns as LayoutColumn[];
      p.texts.slice(0, 2).forEach((t, i) => {
        cols[i] = { ...cols[i]!, heading: t.heading, points: t.body ? [t.body] : [""] };
      });
      break;
    }
    case "quote":
      base.quote = p.title;
      base.source = p.subtitle;
      break;
    default:
      break;
  }
  return sanitizeLayoutConfig(to, base);
}

/**
 * Bù ô trống cho đủ số mục mặc định của bố cục để trình soạn luôn có ô để điền
 * (config đã lưu bỏ mục rỗng nên có thể ít hơn).
 */
export function padForEditing(layout: SlideLayoutId, c: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = { ...c, layout };
  const range = ITEM_RANGE[layout];
  if (range) {
    const items: LayoutItem[] = Array.isArray(c.items) ? [...c.items] : [];
    const seed = (emptyLayoutConfig(layout).items as LayoutItem[]) ?? [];
    while (items.length < Math.max(range.min, seed.length)) items.push({ ...(seed[items.length] ?? { heading: "", body: "" }) });
    out.items = items;
  }
  if (layout === "compare") {
    const cols: LayoutColumn[] = Array.isArray(c.columns) ? [...c.columns] : [];
    const seed = emptyLayoutConfig("compare").columns as LayoutColumn[];
    while (cols.length < 2) cols.push({ ...seed[cols.length]!, points: [""] });
    out.columns = cols.map((col) => ({ ...col, points: col.points?.length ? col.points : [""] }));
  }
  if (layout === "image") {
    const b: string[] = Array.isArray(c.bullets) ? [...c.bullets] : [];
    while (b.length < (MAX_BULLETS.image ?? 3)) b.push("");
    out.bullets = b;
  }
  return out;
}

/**
 * Khoá "meta" đi kèm mọi slide, không thuộc bố cục: ghi chú giảng, cờ ẩn khi trình chiếu, hoa văn trang trí chọn
 * riêng cho slide ("none" hoặc mã hoa văn, xem limioLiveMotifs), kiểu bìa, và dấu vết sinh bằng AI (id dòng dàn ý,
 * slide do AI sinh, đã được giảng viên sửa tay). Hoa văn và kiểu bìa là meta để AI sửa slide hay đổi bố cục không
 * làm mất lựa chọn.
 * Bộ lọc bố cục phải giữ chúng, nếu không việc ẩn slide hay ghi chú sẽ mất lặng lẽ.
 */
export function pickMeta(config: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const c = config ?? {};
  const out: Record<string, unknown> = {};
  if (typeof c.presenterNote === "string" && c.presenterNote.trim()) out.presenterNote = c.presenterNote.trim().slice(0, MAX_LEN.notes);
  if (c.hidden === true) out.hidden = true;
  if (isMotifChoice(c.motif)) out.motif = c.motif;
  if (isCoverStyle(c.coverStyle)) out.coverStyle = c.coverStyle;
  if (typeof c.outlineId === "string" && c.outlineId) out.outlineId = c.outlineId.slice(0, 60);
  if (c.aiGenerated === true) out.aiGenerated = true;
  if (c.editedByUser === true) out.editedByUser = true;
  return out;
}

/**
 * Chuẩn hoá config của slide Nội dung ở máy chủ. Slide có bố cục mới được lọc theo
 * sanitizeLayoutConfig (giữ các khoá meta); slide cũ và slide chèn học liệu giữ nguyên.
 */
export function normalizeContentSlideConfig(config: unknown): unknown {
  if (!config || typeof config !== "object") return config;
  const c = config as Record<string, unknown>;
  const layout = resolveLayout(c);
  if (layout === "classic" || c.resource) return config;
  return { ...sanitizeLayoutConfig(layout, c), ...pickMeta(c) };
}

/**
 * Điền sẵn tên đơn vị và người trình bày cho slide bìa từ dữ liệu có thật (tên trường của giảng viên, tên trong
 * hồ sơ), chỉ vào ô còn trống. AI không bao giờ viết hai dòng này. Slide không phải bìa trả nguyên đối tượng.
 */
export function fillCoverIdentity<T extends Record<string, unknown>>(config: T, who: { org?: string | null; presenter?: string | null }): T {
  if (resolveLayout(config) !== "cover" || config.resource) return config;
  const out: Record<string, unknown> = { ...config };
  const org = clip(who.org, MAX_LEN.org);
  const presenter = clip(who.presenter, MAX_LEN.byline);
  if (org && !clip(config.org, MAX_LEN.org)) out.org = org;
  if (presenter && !clip(config.byline, MAX_LEN.byline)) out.byline = presenter;
  return out as T;
}

// ── Dấu vết sinh bằng AI và việc "đã sửa tay" ───────────────────────────────

// Đổi hoa văn hay kiểu bìa là đổi trang trí, không phải sửa nội dung: không tính là "đã sửa tay".
const IDENTITY_KEYS = ["outlineId", "aiGenerated", "hidden", "editedByUser", "motif", "coverStyle"] as const;

function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v) ?? "null";
}

/** Phần nội dung của config (bỏ các khoá nhận diện/cờ) — để so xem giảng viên có đổi chữ không. */
function contentOf(c: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(c ?? {}) };
  for (const k of IDENTITY_KEYS) delete out[k];
  if (typeof out.presenterNote === "string") out.presenterNote = out.presenterNote.trim();
  if (!out.presenterNote) delete out.presenterNote;
  return out;
}

/**
 * Khi lưu config mới của một slide: giữ dấu vết nhận diện mà trình soạn có thể làm rơi
 * (slide quiz/poll/cũ dựng lại config chỉ từ ô của mình), và đánh dấu `editedByUser` khi
 * giảng viên sửa tay nội dung một slide do AI sinh — để lần cập nhật theo dàn ý sau không ghi đè.
 * - `outlineId`, `aiGenerated`: luôn giữ từ bản cũ nếu bản mới thiếu;
 * - `hidden`: giữ khi bản mới không nhắc đến (bật/tắt ẩn luôn ghi tường minh true/false);
 * - `editedByUser`: đã đặt thì giữ; chưa đặt thì đặt khi nội dung đổi và không phải do AI sửa.
 */
export function mergeSlideMeta(
  existing: Record<string, unknown> | null | undefined,
  next: Record<string, unknown>,
  opts: { fromAi?: boolean } = {},
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...next };
  const old = existing ?? {};
  for (const k of ["outlineId", "aiGenerated"] as const) if (out[k] === undefined && old[k] !== undefined) out[k] = old[k];
  if (out.hidden === undefined && old.hidden === true) out.hidden = true;
  const wasAi = old.aiGenerated === true || out.aiGenerated === true;
  if (old.editedByUser === true || out.editedByUser === true) out.editedByUser = true;
  else if (wasAi && !opts.fromAi && stable(contentOf(old)) !== stable(contentOf(out))) out.editedByUser = true;
  return out;
}

// ── In đậm và in nghiêng trong dòng (tiêu chí H3) ──────────────────────────
// Chỉ hai dấu: **in đậm** và *in nghiêng*. Không có cỡ chữ, font, màu tuỳ chọn.

export interface InlineRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

/** Tách chuỗi thành các đoạn có định dạng. Dấu không có cặp đóng được giữ nguyên là chữ thường. */
export function parseInline(text: string): InlineRun[] {
  const runs: InlineRun[] = [];
  const push = (t: string, bold: boolean, italic: boolean) => {
    if (!t) return;
    const last = runs[runs.length - 1];
    if (last && !!last.bold === bold && !!last.italic === italic) last.text += t;
    else runs.push({ text: t, ...(bold ? { bold: true } : {}), ...(italic ? { italic: true } : {}) });
  };
  let i = 0;
  let bold = false;
  let italic = false;
  let buf = "";
  // Có dấu đóng phía sau chưa? Với "*" chỉ tính dấu đơn (không thuộc một cặp "**").
  const closes = (marker: string, from: number) => {
    if (marker === "**") return text.indexOf("**", from) > -1;
    for (let k = from; k < text.length; k++) {
      if (text[k] !== "*") continue;
      if (text[k + 1] === "*") {
        k += 1;
        continue;
      }
      return true;
    }
    return false;
  };
  while (i < text.length) {
    if (text.startsWith("**", i) && (bold || closes("**", i + 2))) {
      push(buf, bold, italic);
      buf = "";
      bold = !bold;
      i += 2;
    } else if (text[i] === "*" && !text.startsWith("**", i) && (italic || closes("*", i + 1))) {
      push(buf, bold, italic);
      buf = "";
      italic = !italic;
      i += 1;
    } else {
      buf += text[i];
      i += 1;
    }
  }
  push(buf, bold, italic);
  return runs;
}

/** Chữ thuần (đã bỏ dấu định dạng) — dùng để ước lượng độ dài khi chọn cỡ chữ. */
export function stripInline(text: string): string {
  return parseInline(text)
    .map((r) => r.text)
    .join("");
}

/**
 * Bọc (hoặc gỡ) dấu định dạng quanh đoạn đang chọn trong ô nhập. Không có đoạn chọn thì giữ nguyên.
 * Trả về chuỗi mới và vùng chọn mới để giữ con trỏ.
 */
export function toggleInlineMarker(
  value: string,
  start: number,
  end: number,
  marker: "**" | "*",
): { value: string; start: number; end: number } {
  if (start >= end) return { value, start, end };
  const m = marker.length;
  const wrapped = value.slice(Math.max(0, start - m), start) === marker && value.slice(end, end + m) === marker;
  // Với "*", đừng nhầm "**" đang bọc đoạn chọn thành một cặp "*".
  const doubleAround = marker === "*" && value.slice(Math.max(0, start - 2), start) === "**" && value.slice(end, end + 2) === "**";
  if (wrapped && !doubleAround) {
    return { value: value.slice(0, start - m) + value.slice(start, end) + value.slice(end + m), start: start - m, end: end - m };
  }
  return { value: value.slice(0, start) + marker + value.slice(start, end) + marker + value.slice(end), start: start + m, end: end + m };
}

// ── Tách một slide quá dài thành hai (tiêu chí H4) ──────────────────────────

/**
 * Tách slide thành hai slide cùng bố cục, chia đều các mục. Chỉ tách được khi mỗi nửa vẫn đủ
 * số mục tối thiểu của bố cục: danh sách từ 4 mục trở lên (thẻ, bước, số liệu, tóm tắt) và
 * slide chữ và hình có từ 2 ý. Slide thứ hai giữ tiêu đề kèm "(tiếp)", không có ghi chú giảng
 * và không còn gắn với dòng dàn ý. Trả null khi không tách được.
 */
export function splitSlideConfig(config: Record<string, any>): [Record<string, unknown>, Record<string, unknown>] | null {
  const layout = resolveLayout(config);
  const range = ITEM_RANGE[layout];
  const title: string = typeof config.title === "string" ? config.title : "";
  const cont = title ? (/\(tiếp\)\s*$/.test(title) ? title : `${title} (tiếp)`.slice(0, MAX_LEN.title)) : "";
  const meta = pickMeta(config);
  const firstMeta = { ...meta, editedByUser: true };
  // Slide thứ hai là slide mới của giảng viên: không mang ghi chú, dàn ý hay dấu AI.
  const secondMeta: Record<string, unknown> = { editedByUser: true, ...(meta.hidden ? { hidden: true } : {}) };

  if (range && Array.isArray(config.items)) {
    const items: LayoutItem[] = config.items;
    if (items.length < 4) return null;
    const cut = Math.ceil(items.length / 2);
    const a = items.slice(0, cut);
    const b = items.slice(cut);
    if (a.length < range.min || b.length < range.min) return null;
    return [
      { ...sanitizeLayoutConfig(layout, { ...config, items: a }), ...firstMeta },
      { ...sanitizeLayoutConfig(layout, { ...config, title: cont, items: b, footnote: "" }), ...secondMeta },
    ];
  }
  if (layout === "image" && Array.isArray(config.bullets) && config.bullets.length >= 2) {
    const bullets: string[] = config.bullets;
    const cut = Math.ceil(bullets.length / 2);
    return [
      { ...sanitizeLayoutConfig(layout, { ...config, bullets: bullets.slice(0, cut) }), ...firstMeta },
      { ...sanitizeLayoutConfig(layout, { ...config, title: cont, bullets: bullets.slice(cut), imageUrl: "" }), ...secondMeta },
    ];
  }
  return null;
}

/** Hai config slide có giống hệt nhau không (không phân biệt thứ tự khoá). */
/**
 * Slide kế bên của slide đang sửa (delta -1 / +1) để nút ‹ › trong cửa sổ sửa chuyển sang đó.
 * `layoutSlide` cho biết slide đích có dùng được trình sửa bố cục mới không; nếu không (quiz, bảng...)
 * thì cửa sổ phải đóng, vì các loại đó có trình sửa riêng.
 */
export function adjacentSlide(
  slides: Array<{ id: string; type: string; config?: unknown }>,
  currentId: string,
  delta: -1 | 1,
): { id: string; layoutSlide: boolean } | null {
  const i = slides.findIndex((s) => s.id === currentId);
  const t = i < 0 ? undefined : slides[i + delta];
  if (!t) return null;
  const cfg = (t.config ?? {}) as { resource?: unknown };
  return { id: t.id, layoutSlide: t.type === "content" && resolveLayout(t.config) !== "classic" && !cfg.resource };
}

/** Mức thu phóng cho phép khi trình chiếu (khớp các nút thu phóng của màn chiếu). */
export const SLIDE_ZOOM_MIN = 0.5;
export const SLIDE_ZOOM_MAX = 2;

/**
 * Tỉ lệ vẽ cuối cùng của slide bố cục: tỉ lệ vừa khung nhân với mức thu phóng của người trình chiếu.
 * Slide bố cục tự co vừa khung chứa nên KHÔNG dùng CSS zoom của khung ngoài (nó bị triệt tiêu khi tự co lại).
 */
export function layoutRenderScale(fitScale: number, zoom: number | undefined): number {
  const z = Number.isFinite(zoom) ? Math.min(SLIDE_ZOOM_MAX, Math.max(SLIDE_ZOOM_MIN, zoom as number)) : 1;
  return fitScale * z;
}

export function slideConfigsEqual(a: unknown, b: unknown): boolean {
  return stable(a ?? {}) === stable(b ?? {});
}
