// Dàn ý bài giảng tương tác sinh từ tài liệu (bước giữa "tài liệu gốc" và "slide cuối").
// Module thuần: chuẩn hoá đầu ra của mô hình AI và kiểm tra dàn ý giảng viên sửa.
// Không tin thẳng đầu ra mô hình: số slide, bố cục, độ dài, emoji đều được ép ở đây.

import { sanitizeWebImages, type WebImage } from "./limioLiveWebImages";
import { cellNumbersInSource, numbersInText } from "./limioLiveCharts";
import { ITEM_RANGE, SLIDE_LAYOUTS, MAX_LEN, clipText, type SlideLayoutId } from "./limioLiveSlides";
import { extractCites, figureKeys, unsupportedFigures } from "./limioLiveFigures";
import { slideText } from "./limioLiveLanguage";

const STATS_MIN = ITEM_RANGE.stats!.min;

// Tên khớp bộ chọn loại slide trong trình sửa bài giảng. "draw_it" là Dán Note ở chế độ vẽ:
// khi tạo slide nó thành collaborate_board với mode "drawing" (limioLiveGenerate).
export type OutlineKind = "content" | "quiz" | "poll" | "word_cloud" | "collaborate_board" | "draw_it" | "whiteboard";
export const OUTLINE_KINDS: readonly OutlineKind[] = ["content", "quiz", "poll", "word_cloud", "collaborate_board", "draw_it", "whiteboard"];

/** Bố cục dùng được trong dàn ý (không gồm "classic" — chỉ dành cho slide cũ). */
export type OutlineLayout = Exclude<SlideLayoutId, "classic">;
export const OUTLINE_LAYOUTS = SLIDE_LAYOUTS.filter((l): l is OutlineLayout => l !== "classic");

/**
 * Mạch cấu trúc của bài: mỗi slide thuộc một phần. Nội dung có thể có nhiều phần, mỗi phần một tên;
 * các vai trò khác mỗi loại một phần. Giảng viên không chọn vai trò — AI gán khi lập dàn ý, dàn ý cũ
 * được tự chia (inferParts), kéo thả chỉ đổi phần theo vị trí thả.
 */
export type PartRole = "cover" | "objectives" | "agenda" | "hook" | "content" | "summary";
export const PART_ROLES: readonly PartRole[] = ["cover", "objectives", "agenda", "hook", "content", "summary"];
export const PART_ROLE_LABEL: Record<PartRole, string> = {
  cover: "Bìa",
  objectives: "Mục tiêu",
  agenda: "Mục lục",
  hook: "Dẫn dắt vào bài",
  content: "Nội dung",
  summary: "Tổng kết",
};

export interface OutlinePart {
  id: string;
  role: PartRole;
  /** Tên phần Nội dung (cũng là tiêu đề slide mở phần và một dòng của Mục lục). Rỗng với vai trò khác. */
  name: string;
}

/**
 * Nguồn của bài (cột LiveDeck.sourceKind): tài liệu giảng viên đưa, mô tả chủ đề (AI dùng kiến thức chung),
 * hoặc mô tả kèm các trang tìm trên internet. Bài cũ không ghi nguồn được coi như tài liệu.
 */
export type DeckSourceKind = "document" | "topic" | "topic_web";
export const DECK_SOURCE_KINDS: readonly DeckSourceKind[] = ["document", "topic", "topic_web"];
export function resolveSourceKind(v: unknown): DeckSourceKind {
  return DECK_SOURCE_KINDS.includes(v as DeckSourceKind) ? (v as DeckSourceKind) : "document";
}
export const isTopicSource = (k: DeckSourceKind) => k !== "document";

/** Mức kiến thức chung không có số liệu hay câu trích để dựa vào: các bố cục này đổi sang bố cục chữ. */
const TOPIC_LAYOUT_SWAP: Partial<Record<OutlineLayout, OutlineLayout>> = { stats: "cards", chart: "cards", quote: "image" };
export function safeLayoutFor<L extends OutlineLayout | null>(kind: DeckSourceKind, layout: L): L {
  if (kind !== "topic" || !layout) return layout;
  return (TOPIC_LAYOUT_SWAP[layout] ?? layout) as L;
}
export const layoutAllowedFor = (kind: DeckSourceKind, layout: OutlineLayout) => safeLayoutFor(kind, layout) === layout;

/** Trang đã đọc khi soạn bài mức "topic_web" (cột LiveDeck.sourceRefs), số n khớp "[n]" trong sourceText. */
export interface WebSourceRef {
  n: number;
  title: string;
  url: string;
  /** Ảnh trong phần chữ của trang (kèm chữ thay thế), ứng viên cho slide Chữ và hình (docs/tieu-chi/nguon-web-link-anh.md). */
  images?: WebImage[];
}

export function sanitizeRefs(raw: unknown): WebSourceRef[] {
  return (Array.isArray(raw) ? raw : [])
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
    .map((r) => {
      const images = sanitizeWebImages(r.images);
      return {
        n: Number(r.n),
        title: typeof r.title === "string" ? r.title.slice(0, 300) : "",
        url: typeof r.url === "string" ? r.url.slice(0, 2000) : "",
        ...(images.length ? { images } : {}),
      };
    })
    .filter((r) => Number.isInteger(r.n) && r.n > 0 && /^https?:\/\//.test(r.url));
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}


/**
 * Dòng dàn ý "Nguồn tham khảo": hệ thống dựng từ các trang đã đọc, không gửi cho AI viết lại. Mỗi dòng "[n] Tên trang";
 * số [n] nối dòng với trang (link và địa chỉ rút gọn do bước tạo slide gắn), nên giảng viên sửa tên vẫn giữ đúng link.
 */
export function referencesOutlineSlide(refs: WebSourceRef[], lang?: string | null): OutlineSlide {
  const line = (r: WebSourceRef) => clipText(`[${r.n}] ${r.title || hostOf(r.url)}`, MAX_LEN.summaryItem);
  return {
    id: newOutlineId(),
    kind: "content",
    layout: "summary",
    title: slideText(lang).references,
    points: refs.slice(0, OUTLINE_LIMITS.points).map(line),
    fixed: "references",
  };
}

/**
 * Nguồn của một dòng dàn ý trong bài nhập từ file trình chiếu (xem limioLivePptx): "same" = từ một slide gốc,
 * "merge" = gộp nhiều slide gốc, "split" = một trong các slide tách từ một slide gốc dài (AI viết), "new" = mới (có `slides` thì là "dựa trên" các slide đó), "back" = giảng viên thêm
 * lại một slide gốc chưa dùng. `piece/pieces`: slide gốc dài chia thành nhiều slide. `sig`: dấu các ý lúc nhập,
 * để biết giảng viên đã sửa các ý của dòng hay chưa.
 */
export type OriginHow = "same" | "merge" | "split" | "new" | "back";
export const ORIGIN_HOWS: readonly OriginHow[] = ["same", "merge", "split", "new", "back"];
export interface OutlineOrigin {
  slides: number[];
  how: OriginHow;
  piece?: number;
  pieces?: number;
  sig?: string;
}

export function sanitizeOrigin(raw: unknown): OutlineOrigin | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  if (!ORIGIN_HOWS.includes(o.how as OriginHow)) return undefined;
  const slides = [...new Set((Array.isArray(o.slides) ? o.slides : []).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 2000))].slice(0, 40);
  const out: OutlineOrigin = { slides, how: o.how as OriginHow };
  const piece = Number(o.piece);
  const pieces = Number(o.pieces);
  if (Number.isInteger(piece) && Number.isInteger(pieces) && piece >= 1 && pieces >= piece && pieces <= 50) Object.assign(out, { piece, pieces });
  if (typeof o.sig === "string" && /^[0-9a-z]{1,16}$/.test(o.sig)) out.sig = o.sig;
  return out;
}

/** Dòng lấy nguyên từ một slide gốc: khi tạo slide dựng thẳng từ dữ liệu đã đọc, không qua AI. */
export function isImportedRow(s: Pick<OutlineSlide, "kind" | "origin">): boolean {
  const o = s.origin;
  return !!o && s.kind === "content" && (o.how === "same" || o.how === "back") && o.slides.length === 1;
}

/** "5", "5 và 6", "5, 6, 7 và 8". */
export function listVi(ns: number[]): string {
  const a = ns.map(String);
  return a.length <= 2 ? a.join(" và ") : `${a.slice(0, -1).join(", ")} và ${a[a.length - 1]}`;
}

/** Nguồn của dòng như trong màn đối chiếu: "từ slide 4", "gộp slide 5, 6 và 7", "mới, dựa trên slide 6"… */
export function originLabel(o: OutlineOrigin | undefined): string {
  if (!o) return "";
  if (o.how === "back") return `thêm lại từ slide ${o.slides[0] ?? ""}`;
  if (o.how === "merge") return `gộp slide ${listVi(o.slides)}`;
  if (o.how === "split") return `tách từ slide ${listVi(o.slides)}`;
  if (o.how === "new") return o.slides.length ? `mới, dựa trên slide ${listVi(o.slides)}` : "mới";
  const part = o.pieces && o.pieces > 1 ? `, phần ${o.piece}/${o.pieces}` : "";
  return `từ slide ${listVi(o.slides)}${part}`;
}

export interface OutlineSlide {
  id: string;
  /** "references" = dòng Nguồn tham khảo do hệ thống dựng (bài mức topic_web): tạo slide giữ nguyên chữ, không gọi AI. */
  fixed?: "references";
  /** Phần chứa slide; sanitizeOutline luôn gán. */
  partId?: string;
  kind: OutlineKind;
  /** null với slide tương tác. */
  layout: OutlineLayout | null;
  /** Slide nội dung: tiêu đề. Slide tương tác: câu hỏi hoặc câu gợi ý. */
  title: string;
  /** Ý chính: câu hoàn chỉnh. Rỗng với slide tương tác. */
  points: string[];
  /** Bài nhập từ file trình chiếu: dòng này lấy từ slide gốc nào. */
  origin?: OutlineOrigin;
}

export interface Outline {
  title: string;
  slides: OutlineSlide[];
  /** Theo thứ tự xuất hiện trong bài; chỉ gồm phần đang có slide. */
  parts: OutlinePart[];
}

/**
 * Thời lượng buổi giảng → khoảng số slide hợp lý (tiêu chí L3). Mỗi phần nội dung có 1 đến 2 slide tương tác
 * và bài kết bằng một slide đáng nhớ sau slide Tóm tắt, nên mức slide rộng hơn bài chỉ có chữ.
 */
export const DURATIONS = [
  { minutes: 15, min: 9, max: 12 },
  { minutes: 30, min: 16, max: 20 },
  { minutes: 45, min: 22, max: 28 },
  // Buổi dài (docs/tieu-chi/tao-bai-giang-mot-o.md, M11): đủ mạch, 4 đến 6 phần nội dung.
  { minutes: 90, min: 42, max: 50 },
] as const;

/** Số slide tương tác gợi ý cho mỗi phần nội dung. */
export const INTERACTIVE_PER_PART = { min: 1, max: 2 } as const;

/**
 * Buổi từ 30 phút có đủ mạch: Mục tiêu, Mục lục và slide mở mỗi phần. Buổi 15 phút chỉ có 9–12 slide,
 * mấy slide đó sẽ chiếm gần nửa bài, nên mục tiêu nằm trên Bìa và chuyển phần bằng lời trong ghi chú giảng.
 */
export function isFullStructure(minutes: number): boolean {
  return minutes >= 30;
}

export const OUTLINE_LIMITS = {
  title: 120,
  slideTitle: 200,
  point: 200,
  points: 5,
  // Bài nhập từ PowerPoint giữ mọi slide gốc (thường dài hơn bài AI soạn); AI vẫn bị ép theo mức slide của thời lượng.
  maxSlides: 120,
  partName: 120,
  maxParts: 20,
} as const;

export function slideRange(minutes: number): { min: number; max: number } {
  const d = DURATIONS.find((x) => x.minutes === minutes) ?? DURATIONS[1];
  return { min: d.min, max: d.max };
}

export function isValidMinutes(m: unknown): m is (typeof DURATIONS)[number]["minutes"] {
  return DURATIONS.some((d) => d.minutes === m);
}

/** Bỏ emoji và ký hiệu trang trí (tiêu chí G6); giữ nguyên chữ có dấu, số, dấu câu. */
export function stripEmoji(text: string): string {
  return text
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{20E3}\u{2190}-\u{21FF}\u{2300}-\u{23FF}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const clean = (v: unknown, max: number): string => (typeof v === "string" ? stripEmoji(v).slice(0, max) : "");

let seq = 0;
export function newOutlineId(): string {
  seq += 1;
  return `o${Date.now().toString(36)}${seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
export function newPartId(): string {
  seq += 1;
  return `p${Date.now().toString(36)}${seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// Tên hoạt động AI hay ghi vào đầu tiêu đề thay vì đặt đúng "kind" ("Quiz: …", "Word Cloud: …", "Bình chọn: …").
const KIND_PREFIXES: Array<[RegExp, Exclude<OutlineKind, "content">]> = [
  [/^(quiz|trắc nghiệm|câu hỏi nhanh)$/i, "quiz"],
  [/^(poll|vote|bình chọn|thăm dò)$/i, "poll"],
  [/^(word[ _-]?cloud|đám mây từ( khoá)?)$/i, "word_cloud"],
  [/^(collaborate[ _-]?board|padlet|bảng cộng tác|bảng ghi chú)$/i, "collaborate_board"],
  [/^(draw[ _-]?it|vẽ hình|cùng vẽ)$/i, "draw_it"],
  [/^(white[ _-]?board|bảng trắng)$/i, "whiteboard"],
];

/**
 * Dòng nội dung mà tiêu đề mở đầu bằng tên một hoạt động tương tác ("Quiz: …", "Draw It: …") là slide tương tác AI quên
 * đặt đúng loại: trả loại đó cùng tiêu đề đã bỏ tiền tố; tiêu đề thường thì null (người dùng báo 2026-10-19).
 */
export function interactiveFromTitle(title: string): { kind: Exclude<OutlineKind, "content">; title: string } | null {
  const m = /^\s*([^:\-–]{2,24}?)\s*[:\-–]\s*(.+)$/u.exec(title);
  if (!m) return null;
  const hit = KIND_PREFIXES.find(([re]) => re.test(m[1]!.trim()));
  const rest = m[2]!.trim();
  return hit && rest ? { kind: hit[1], title: rest } : null;
}

/**
 * Dòng nội dung mang tên hoạt động trong dàn ý AI vừa soạn (người dùng báo 2026-10-19). Thường AI viết một slide "giới thiệu
 * trước" ("Quiz: …") rồi ngay sau đó mới là slide tương tác thật cùng loại: dòng giới thiệu đó thừa, bỏ đi. Không có slide
 * thật đi kèm (trong 2 dòng kế tiếp, cùng phần) thì đổi chính dòng đó thành slide tương tác. Chỉ dùng cho dàn ý AI trả về,
 * không tự xoá gì trong bài đã có.
 */
export function fixNamedInteractions(slides: OutlineSlide[]): OutlineSlide[] {
  const out: OutlineSlide[] = [];
  slides.forEach((s, i) => {
    const named = s.kind === "content" && !s.fixed ? interactiveFromTitle(s.title) : null;
    if (!named) return void out.push(s);
    const real = slides.slice(i + 1, i + 3).some((n) => n.kind === named.kind && n.partId === s.partId);
    if (real) return;
    out.push({ id: s.id, ...(s.partId ? { partId: s.partId } : {}), ...(s.origin ? { origin: s.origin } : {}), kind: named.kind, layout: null, title: named.title, points: [] });
  });
  return out;
}

function sanitizeSlide(raw: unknown, idFallback = newOutlineId): OutlineSlide | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const kind: OutlineKind = OUTLINE_KINDS.includes(o.kind as OutlineKind) ? (o.kind as OutlineKind) : "content";
  const title = clean(o.title, OUTLINE_LIMITS.slideTitle);
  const origin = sanitizeOrigin(o.origin);
  const part = {
    ...(typeof o.partId === "string" && o.partId ? { partId: o.partId.slice(0, 60) } : {}),
    ...(origin ? { origin } : {}),
  };
  if (kind === "content") {
    const layout: OutlineLayout = OUTLINE_LAYOUTS.includes(o.layout as OutlineLayout) ? (o.layout as OutlineLayout) : "image";
    const points = (Array.isArray(o.points) ? o.points : [])
      .map((p) => clean(p, OUTLINE_LIMITS.point))
      .filter(Boolean)
      .slice(0, OUTLINE_LIMITS.points);
    const fixed = o.fixed === "references" ? { fixed: "references" as const } : {};
    return { id: typeof o.id === "string" && o.id ? o.id.slice(0, 60) : idFallback(), ...part, kind, layout, title, points, ...fixed };
  }
  return { id: typeof o.id === "string" && o.id ? o.id.slice(0, 60) : idFallback(), ...part, kind, layout: null, title, points: [] };
}

function sanitizeParts(raw: unknown): OutlinePart[] {
  const seen = new Set<string>();
  const out: OutlinePart[] = [];
  for (const r of Array.isArray(raw) ? raw : []) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    if (typeof o.id !== "string" || !o.id || seen.has(o.id)) continue;
    const role = PART_ROLES.includes(o.role as PartRole) ? (o.role as PartRole) : "content";
    seen.add(o.id);
    out.push({ id: o.id.slice(0, 60), role, name: role === "content" ? clean(o.name, OUTLINE_LIMITS.partName) : "" });
    if (out.length >= OUTLINE_LIMITS.maxParts) break;
  }
  return out;
}

const isOpener = (s: OutlineSlide | undefined) => !!s && s.kind === "content" && s.layout === "section";

/**
 * Slide kết bài: slide nội dung cuối (không tính dòng hệ thống dựng) có bố cục Trích dẫn, đứng ngay sau
 * slide Tóm tắt (bỏ qua slide tương tác ở giữa). Đó là câu đáng nhớ khép lại buổi học, nên nó không bị ép
 * thành Tóm tắt và được giữ bố cục Trích dẫn cả ở bài không có tài liệu. Trả chỉ số của hai slide, hoặc null.
 */
export function closingIndex(slides: readonly OutlineSlide[]): { summary: number; closing: number } | null {
  let closing = -1;
  for (let i = slides.length - 1; i >= 0; i--) {
    const s = slides[i]!;
    if (s.kind !== "content" || s.fixed) continue;
    closing = i;
    break;
  }
  if (closing <= 0 || slides[closing]!.layout !== "quote") return null;
  for (let i = closing - 1; i > 0; i--) {
    const s = slides[i]!;
    if (s.kind !== "content") continue;
    return s.layout === "summary" ? { summary: i, closing } : null;
  }
  return null;
}

/** Slide kết bài của dàn ý đã chia phần: slide Trích dẫn cuối của phần Tổng kết, sau slide Tóm tắt. */
export function isClosingSlide(o: Pick<Outline, "slides" | "parts">, s: OutlineSlide): boolean {
  const c = closingIndex(o.slides);
  if (!c || o.slides[c.closing] !== s) return false;
  return o.parts.find((p) => p.id === s.partId)?.role === "summary";
}

/**
 * Chia dàn ý chưa có phần (dàn ý tạo trước khi có mạch cấu trúc, hoặc mô hình không gán vai trò):
 * Bìa đầu bài; mỗi slide "Mở phần" mở một phần Nội dung mang tên slide đó; slide Tóm tắt cuối (hoặc slide
 * Tóm tắt đứng trước slide kết bài) và các slide sau nó vào Tổng kết; phần còn lại vào phần Nội dung đang mở.
 */
export function inferParts(o: Pick<Outline, "title" | "slides">, lang?: string | null): Outline {
  const parts: OutlinePart[] = [];
  const slides = o.slides.map((s) => ({ ...s }));
  let lastContent = -1;
  slides.forEach((s, i) => {
    if (s.kind === "content" && !s.fixed) lastContent = i;
  });
  const summaryAt = closingIndex(slides)?.summary ?? lastContent;
  let cur: OutlinePart | null = null;
  const open = (role: PartRole, name = "") => {
    cur = { id: newPartId(), role, name };
    parts.push(cur);
  };
  slides.forEach((s, i) => {
    if (i === 0 && s.kind === "content" && s.layout === "cover") open("cover");
    else if (isOpener(s)) open("content", s.title);
    else if (i === summaryAt && i > 0 && s.layout === "summary") open("summary");
    else if (!cur || cur.role === "cover") open("content");
    s.partId = cur!.id;
  });
  const unnamed = parts.filter((p) => p.role === "content" && !p.name);
  const contentCount = parts.filter((p) => p.role === "content").length;
  unnamed.forEach((p, k) => {
    p.name = contentCount === 1 ? slideText(lang).mainContent : slideText(lang).part(k + 1);
  });
  return { title: o.title, slides, parts };
}

/**
 * Giữ bất biến của mạch cấu trúc sau mọi thay đổi: slide thiếu phần lấy phần của slide đứng trước
 * (hoặc sau); một phần đã đóng mà xuất hiện lại thì các slide đó thuộc phần đang mở (phần luôn liền nhau);
 * phần hết slide bị bỏ; thứ tự phần theo thứ tự xuất hiện. Sau đó đồng bộ chữ tự sinh (syncDerived).
 */
export function finalizeParts(o: Outline): Outline {
  const byId = new Map(o.parts.map((p) => [p.id, { ...p }]));
  if (o.slides.length > 0 && !o.slides.some((s) => s.partId && byId.has(s.partId))) return syncDerived(inferParts(o));

  const slides = o.slides.map((s) => ({ ...s, partId: s.partId && byId.has(s.partId) ? s.partId : undefined }));
  let prev: string | undefined;
  for (const s of slides) {
    if (s.partId) prev = s.partId;
    else s.partId = prev;
  }
  const first = slides.find((s) => s.partId)?.partId;
  for (const s of slides) {
    if (s.partId) break;
    s.partId = first;
  }
  const closed = new Set<string>();
  let cur: string | undefined;
  for (const s of slides) {
    if (s.partId === cur) continue;
    if (closed.has(s.partId!)) {
      s.partId = cur;
      continue;
    }
    if (cur) closed.add(cur);
    cur = s.partId;
  }
  const parts = [...new Set(slides.map((s) => s.partId!))].map((id) => byId.get(id)!);
  return syncDerived({ title: o.title, slides, parts });
}

/**
 * Chữ do mạch cấu trúc quyết định, không do giảng viên nhập: tiêu đề slide mở phần = tên phần
 * (phần chưa có tên thì lấy tiêu đề slide), các ý của slide Mục lục = tên các phần Nội dung.
 */
export function syncDerived(o: Outline): Outline {
  const parts = o.parts.map((p) => ({ ...p }));
  const slides = o.slides.map((s) => ({ ...s }));
  const firstOf = new Map<string, OutlineSlide>();
  for (const s of slides) if (s.partId && !firstOf.has(s.partId)) firstOf.set(s.partId, s);
  for (const p of parts) {
    if (p.role !== "content") continue;
    const opener = firstOf.get(p.id);
    if (!isOpener(opener)) continue;
    if (!p.name.trim() && opener!.title.trim()) p.name = opener!.title.slice(0, OUTLINE_LIMITS.partName);
    opener!.title = p.name;
  }
  const names = parts.filter((p) => p.role === "content").map((p) => p.name.trim()).filter(Boolean).slice(0, OUTLINE_LIMITS.points);
  for (const p of parts) {
    if (p.role !== "agenda") continue;
    const s = slides.find((x) => x.partId === p.id && x.kind === "content");
    if (s) s.points = names;
  }
  return { title: o.title, slides, parts };
}

/** Vai trò của slide trong mạch: slide mở phần và slide Mục lục có chữ tự sinh. */
export function slideStructureRole(o: Outline, s: OutlineSlide): "opener" | "agenda" | null {
  const part = o.parts.find((p) => p.id === s.partId);
  if (!part) return null;
  const first = o.slides.find((x) => x.partId === part.id);
  if (part.role === "content" && first === s && isOpener(s)) return "opener";
  if (part.role === "agenda" && o.slides.find((x) => x.partId === part.id && x.kind === "content") === s) return "agenda";
  return null;
}

/** Nhãn phần như trong dàn ý: "Dẫn dắt vào bài", "Nội dung 2: Ứng dụng AR trong lớp học". */
export function partLabel(o: Outline, partId: string): string {
  const p = o.parts.find((x) => x.id === partId);
  if (!p) return "";
  if (p.role !== "content") return PART_ROLE_LABEL[p.role];
  const k = o.parts.filter((x) => x.role === "content").indexOf(p) + 1;
  return `${PART_ROLE_LABEL.content} ${k}: ${p.name}`;
}

/** Thông tin mạch cho bước tạo slide: số và mục lục của slide mở phần, các dòng của slide Mục lục. */
export interface SlideStructure {
  sectionNo?: string;
  toc?: string[];
  tocCurrent?: number;
  agenda?: string[];
  /** Slide kết bài (isClosingSlide): giữ bố cục Trích dẫn kể cả ở bài không có tài liệu. */
  closing?: true;
}

export function slideStructures(o: Outline): Array<SlideStructure | null> {
  const contentParts = o.parts.filter((p) => p.role === "content");
  const names = contentParts.map((p) => p.name.trim());
  return o.slides.map((s) => {
    const role = slideStructureRole(o, s);
    if (role === "opener") {
      const k = contentParts.findIndex((p) => p.id === s.partId) + 1;
      return { sectionNo: String(k).padStart(2, "0"), toc: names, tocCurrent: k };
    }
    if (role === "agenda") return { agenda: names };
    if (isClosingSlide(o, s)) return { closing: true };
    return null;
  });
}

/** Lưu dàn ý do giảng viên sửa: lọc trường, cắt độ dài, giữ id, giữ bất biến của phần. Slide rỗng hoàn toàn bị bỏ. */
export function sanitizeOutline(raw: unknown): Outline {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const seen = new Set<string>();
  const slides: OutlineSlide[] = [];
  for (const r of Array.isArray(o.slides) ? o.slides : []) {
    const s = sanitizeSlide(r);
    if (!s) continue;
    if (!s.title && s.points.length === 0) continue;
    if (seen.has(s.id)) s.id = newOutlineId();
    seen.add(s.id);
    slides.push(s);
    if (slides.length >= OUTLINE_LIMITS.maxSlides) break;
  }
  return finalizeParts({ title: clean(o.title, OUTLINE_LIMITS.title), slides, parts: sanitizeParts(o.parts) });
}

/**
 * Đầu ra mô hình ghi vai trò ("role") và tên phần ("section") trên từng slide; gom các slide liền nhau
 * cùng vai trò (và cùng tên với phần Nội dung) thành một phần. Vai trò lạ coi như tiếp tục phần trước.
 */
function partsFromRaw(raw: unknown): { value: unknown; fromRoles: boolean } {
  if (!raw || typeof raw !== "object") return { value: raw, fromRoles: false };
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.slides)) return { value: raw, fromRoles: false };
  const parts: OutlinePart[] = [];
  let key = "";
  let curId: string | undefined;
  const slides = o.slides.map((r: unknown) => {
    if (!r || typeof r !== "object") return r;
    const x = r as Record<string, unknown>;
    const role = PART_ROLES.includes(x.role as PartRole) ? (x.role as PartRole) : null;
    if (!role) return { ...x, partId: curId };
    const name = role === "content" ? clean(x.section, OUTLINE_LIMITS.partName) : "";
    const k = role === "content" ? `content:${name.toLowerCase()}` : role;
    if (!curId || k !== key) {
      curId = newPartId();
      parts.push({ id: curId, role, name });
      key = k;
    }
    return { ...x, partId: curId };
  });
  return parts.length ? { value: { ...o, slides, parts }, fromRoles: true } : { value: raw, fromRoles: false };
}

/**
 * Chuẩn hoá đầu ra thô của mô hình thành dàn ý hợp lệ cho thời lượng đã chọn.
 * - ép slide đầu là bìa, slide nội dung cuối là tóm tắt;
 * - quá nhiều slide thì giữ phần đầu và slide cuối;
 * - trả kèm cảnh báo để giao diện nói rõ với giảng viên những gì đã chỉnh hoặc còn lệch.
 */
export interface OutlineSourceOptions {
  /** Mặc định "document" (hành vi cũ). */
  sourceKind?: DeckSourceKind;
  /** Văn bản nguồn của bài (mô tả, hoặc mô tả kèm các trang đã đọc): con số có ở đây không bị cảnh báo. */
  sourceText?: string;
  /** Hoặc sẵn tập khoá số của văn bản nguồn (giao diện không tải cả văn bản nguồn). */
  sourceFigureKeys?: string[];
  /** Mức topic_web: các trang đã đọc; thêm dòng "Nguồn tham khảo" cuối dàn ý. */
  references?: WebSourceRef[];
  /** Ngôn ngữ của bài: tên phần tự đặt và tiêu đề "Nguồn tham khảo" theo ngôn ngữ này (docs/tieu-chi/ngon-ngu-slide.md). */
  lang?: string | null;
}

export function normalizeOutline(raw: unknown, minutes: number, opts: OutlineSourceOptions = {}): { outline: Outline; warnings: string[] } {
  const warnings: string[] = [];
  const kind = opts.sourceKind ?? "document";
  const refs = kind === "topic_web" ? (opts.references ?? []) : [];
  const pre = partsFromRaw(raw);
  let outline = sanitizeOutline(pre.value);
  // Slide "Quiz: …" dạng nội dung: bỏ nếu ngay sau đã có slide tương tác thật, không thì đổi thành slide tương tác.
  outline = { ...outline, slides: fixNamedInteractions(outline.slides) };
  const { min } = slideRange(minutes);
  // Dòng Nguồn tham khảo chiếm một chỗ trong mức slide.
  const max = slideRange(minutes).max - (refs.length ? 1 : 0);
  // Không tin mô hình đã tuân lược đồ: bài không có tài liệu không được có Số liệu, Biểu đồ hay Trích dẫn.
  // Riêng slide kết bài giữ Trích dẫn: đó là câu khép lại buổi học do bài viết ra, không dẫn lời ai.
  const closingAt = closingIndex(outline.slides)?.closing ?? -1;
  outline.slides.forEach((s, i) => {
    if (i !== closingAt) s.layout = safeLayoutFor(kind, s.layout);
    // Mức kiến thức chung không có nguồn nào để dẫn: số [n] mô hình lỡ ghi là bịa.
    if (kind === "topic") {
      s.title = extractCites(s.title).text;
      s.points = s.points.map((p) => extractCites(p).text).filter(Boolean);
    }
  });
  // Biểu đồ và Số liệu phải có số trong nguồn; không có thì đổi sang bố cục khác và báo. Chạy sau khi đã
  // ép bố cục theo loại nguồn, để slide mức kiến thức chung (vốn không được có hai bố cục này) không bị báo thừa.
  if (opts.sourceText !== undefined) warnings.push(...demoteUnbackedCharts(outline, opts.sourceText));

  if (outline.slides.length > max) {
    const had = outline.slides.length;
    // Giữ nguyên đuôi bài: slide cuối, hoặc cả slide Tóm tắt lẫn slide kết bài khi có.
    const c = closingIndex(outline.slides);
    const tail = c ? Math.min(had - c.summary, 3) : 1;
    outline.slides = [...outline.slides.slice(0, max - tail), ...outline.slides.slice(had - tail)];
    warnings.push(`AI đề xuất ${had} slide, đã giữ ${max} slide cho buổi ${minutes} phút. Bạn có thể thêm lại slide ở bước này.`);
  }

  const first = outline.slides[0];
  if (first && first.kind === "content" && first.layout !== "cover") first.layout = "cover";
  // Có slide kết bài thì slide Tóm tắt đứng trước nó; không có thì slide nội dung cuối thành Tóm tắt.
  if (!closingIndex(outline.slides)) {
    const lastContent = [...outline.slides].reverse().find((s) => s.kind === "content");
    if (lastContent && lastContent !== first && lastContent.layout !== "summary") lastContent.layout = "summary";
  }
  // Mô hình không gán vai trò: chia lại sau khi đã ép bìa/tóm tắt, để hai slide đó vào đúng phần.
  outline = finalizeParts(pre.fromRoles ? outline : inferParts(outline, opts.lang));

  // Buổi đủ mạch: phần Nội dung nào chưa mở bằng slide "Mở phần" thì thêm, nếu còn chỗ trong mức slide.
  if (isFullStructure(minutes)) {
    for (const p of outline.parts.filter((x) => x.role === "content")) {
      if (outline.slides.length >= max) break;
      const at = outline.slides.findIndex((s) => s.partId === p.id);
      if (at < 0 || isOpener(outline.slides[at])) continue;
      outline.slides.splice(at, 0, { id: newOutlineId(), partId: p.id, kind: "content", layout: "section", title: p.name, points: [] });
    }
    outline = finalizeParts(outline);
  }

  if (refs.length) {
    outline.slides.push({ ...referencesOutlineSlide(refs, opts.lang), partId: outline.slides[outline.slides.length - 1]?.partId });
    outline = finalizeParts(outline);
  }

  warnings.push(...outlineWarnings(outline, minutes, opts).filter((w) => !warnings.includes(w)));
  return { outline, warnings };
}

/**
 * Chống bịa số liệu ngay từ dàn ý, cùng luật với lúc sinh slide (configFromOutline):
 * - Biểu đồ cần ít nhất hai ý có số, mọi số đó phải có trong tài liệu gốc; không đạt thì đổi sang Chữ và hình.
 * - Số liệu: mọi số trong các ý phải có trong tài liệu gốc và cần ít nhất ITEM_RANGE.stats.min ý có số;
 *   không đạt thì đổi sang Ba thẻ, để giảng viên thấy ngay thay vì đến lúc tạo slide mới âm thầm đổi.
 * Giữ nguyên các ý. Sửa tại chỗ; trả về các câu cảnh báo.
 */
export function demoteUnbackedCharts(outline: Pick<Outline, "slides">, sourceText: string): string[] {
  const found = numbersInText(sourceText);
  const warnings: string[] = [];
  for (const s of outline.slides) {
    if (s.kind !== "content") continue;
    const name = s.title || "không tên";
    const withNum = s.points.filter((p) => /\d/.test(p));
    if (s.layout === "chart") {
      if (withNum.length >= 2 && withNum.every((p) => cellNumbersInSource(p.replace(/^[^:]*:\s*/, ""), found))) continue;
      s.layout = "image";
      warnings.push(`Slide “${name}”: tài liệu không có đủ số liệu cho biểu đồ, đã đổi sang Chữ và hình.`);
    } else if (s.layout === "stats") {
      // Kiểm cả ý: lúc sinh slide, con số lớn có thể lấy từ bất cứ chỗ nào trong ý.
      if (!withNum.every((p) => cellNumbersInSource(p, found))) {
        s.layout = "cards";
        warnings.push(`Slide “${name}”: có con số không tìm thấy trong tài liệu, nên slide đã đổi từ Số liệu sang Ba thẻ.`);
      } else if (withNum.length < STATS_MIN) {
        s.layout = "cards";
        warnings.push(`Slide “${name}”: cần ít nhất ${STATS_MIN} ý có con số lấy từ tài liệu để dựng Số liệu, nên slide đã đổi sang Ba thẻ.`);
      }
    }
  }
  return warnings;
}

export function outlineStats(outline: Pick<Outline, "slides"> & { title?: string }): { total: number; content: number; interactive: number } {
  const interactive = outline.slides.filter((s) => s.kind !== "content").length;
  return { total: outline.slides.length, content: outline.slides.length - interactive, interactive };
}

/** Điểm lệch so với khuyến nghị — chỉ nhắc, không chặn (giảng viên là người quyết). */
export function outlineWarnings(
  outline: Pick<Outline, "slides"> & { title?: string; parts?: OutlinePart[] },
  minutes: number,
  opts: Pick<OutlineSourceOptions, "sourceKind" | "sourceText" | "sourceFigureKeys"> = {},
): string[] {
  const w: string[] = [];
  const { min, max } = slideRange(minutes);
  const st = outlineStats(outline);
  if (st.total < min) w.push(`Dàn ý có ${st.total} slide, ít hơn mức gợi ý ${min} đến ${max} slide cho buổi ${minutes} phút.`);
  if (st.total > max && !w.length) w.push(`Dàn ý có ${st.total} slide, nhiều hơn mức gợi ý ${min} đến ${max} slide cho buổi ${minutes} phút.`);
  if (st.interactive === 0 && st.total >= 6) w.push("Dàn ý chưa có slide tương tác nào (trắc nghiệm, bình chọn, đám mây từ hoặc bảng cộng tác).");
  // Mức tối thiểu theo thời lượng (tao-bai-giang-mot-o.md, M14, M19): nhắc, không chặn.
  const minInteractive = minutes >= 90 ? 10 : 5;
  if (st.interactive > 0 && st.interactive < minInteractive)
    w.push(`Bài nên có ít nhất ${minInteractive} slide tương tác (hiện có ${st.interactive}).`);
  // Bố cục phong phú (M24): quá nửa slide nội dung là Chữ và hình thì nhắc đổi bớt.
  const body = outline.slides.filter((s) => s.kind === "content" && !s.fixed && !["cover", "section", "summary", "quote"].includes(s.layout ?? ""));
  const images = body.filter((s) => (s.layout ?? "image") === "image").length;
  if (images >= 4 && images * 2 > body.length)
    w.push(`Nhiều slide Chữ và hình (${images} trên ${body.length} slide nội dung); nên đổi vài slide sang Ba thẻ, Các bước hoặc So sánh.`);
  for (let i = 1; i < outline.slides.length; i++) {
    if (outline.slides[i]!.kind !== "content" && outline.slides[i - 1]!.kind !== "content") {
      w.push("Có hai slide tương tác liền nhau; nên xen slide nội dung ở giữa.");
      break;
    }
  }
  const last = outline.slides[outline.slides.length - 1];
  if (last && last.kind !== "content") w.push("Slide cuối đang là slide tương tác; nên kết bài bằng slide tóm tắt.");
  // Bài đã có tương tác nhưng dồn vào vài phần: nhắc riêng từng phần còn chỉ có chữ.
  if (st.interactive > 0) {
    const quiet = (outline.parts ?? [])
      .filter((p) => p.role === "content" && outline.slides.some((s) => s.partId === p.id))
      .filter((p) => !outline.slides.some((s) => s.partId === p.id && s.kind !== "content"))
      .map((p) => `“${p.name || "không tên"}”`);
    if (quiet.length) w.push(`Phần ${quiet.slice(0, 3).join(", ")} chưa có slide tương tác; nên thêm một câu hỏi nhanh, bình chọn hoặc đám mây từ.`);
  }
  w.push(...figureWarnings(outline, opts));
  return w;
}

/**
 * Bài từ mô tả chủ đề: con số kiểu thống kê trong dàn ý mà không có trong mô tả (hoặc các trang đã đọc) có thể do AI bịa.
 * Chỉ nhắc, không chặn; khi tạo slide, con số AI thêm ngoài dàn ý đã chốt mới bị loại.
 */
export function figureWarnings(
  outline: Pick<Outline, "slides">,
  opts: Pick<OutlineSourceOptions, "sourceKind" | "sourceText" | "sourceFigureKeys">,
): string[] {
  const kind = opts.sourceKind ?? "document";
  if (kind === "document") return [];
  const keys = opts.sourceFigureKeys ? new Set(opts.sourceFigureKeys) : figureKeys(opts.sourceText ?? "");
  const where = kind === "topic" ? "mô tả của bạn" : "các trang đã đọc";
  const hits = outline.slides
    .map((s, i) => ({ i, figs: s.fixed ? [] : unsupportedFigures([s.title, ...s.points].join("\n"), keys) }))
    .filter((h) => h.figs.length);
  const out = hits
    .slice(0, 3)
    .map((h) => `Slide ${h.i + 1} có con số ${h.figs.slice(0, 3).map((f) => `"${f}"`).join(", ")} không có trong ${where}; hãy kiểm tra trước khi dạy.`);
  if (hits.length > 3) out.push(`Còn ${hits.length - 3} slide khác có con số cần kiểm tra.`);
  return out;
}

/** Lỗi chặn việc tạo slide: dàn ý rỗng hoặc có slide chưa có tiêu đề. */
export function outlineBlockingProblems(outline: Pick<Outline, "slides"> & { title?: string }): string[] {
  const p: string[] = [];
  if (outline.slides.length === 0) p.push("Dàn ý chưa có slide nào.");
  outline.slides.forEach((s, i) => {
    if (!s.title.trim()) p.push(`Slide ${i + 1} chưa có ${s.kind === "content" ? "tiêu đề" : "câu hỏi"}.`);
  });
  return p;
}
