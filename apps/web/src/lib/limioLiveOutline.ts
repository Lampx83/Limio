// Dàn ý bài giảng tương tác sinh từ tài liệu (bước giữa "tài liệu gốc" và "slide cuối").
// Module thuần: chuẩn hoá đầu ra của mô hình AI và kiểm tra dàn ý giảng viên sửa.
// Không tin thẳng đầu ra mô hình: số slide, bố cục, độ dài, emoji đều được ép ở đây.

import { SLIDE_LAYOUTS, type SlideLayoutId } from "./limioLiveSlides";
import { cellNumbersInSource, numbersInText } from "./limioLiveCharts";

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
  hook: "Hook",
  content: "Nội dung",
  summary: "Tổng kết",
};

export interface OutlinePart {
  id: string;
  role: PartRole;
  /** Tên phần Nội dung (cũng là tiêu đề slide mở phần và một dòng của Mục lục). Rỗng với vai trò khác. */
  name: string;
}

export interface OutlineSlide {
  id: string;
  /** Phần chứa slide; sanitizeOutline luôn gán. */
  partId?: string;
  kind: OutlineKind;
  /** null với slide tương tác. */
  layout: OutlineLayout | null;
  /** Slide nội dung: tiêu đề. Slide tương tác: câu hỏi hoặc câu gợi ý. */
  title: string;
  /** Ý chính: câu hoàn chỉnh. Rỗng với slide tương tác. */
  points: string[];
}

export interface Outline {
  title: string;
  slides: OutlineSlide[];
  /** Theo thứ tự xuất hiện trong bài; chỉ gồm phần đang có slide. */
  parts: OutlinePart[];
}

/** Thời lượng buổi giảng → khoảng số slide hợp lý (tiêu chí L3). */
export const DURATIONS = [
  { minutes: 15, min: 8, max: 10 },
  { minutes: 30, min: 14, max: 18 },
  { minutes: 45, min: 20, max: 25 },
] as const;

/** Cứ bấy nhiêu slide nội dung thì có một slide tương tác. */
export const INTERACTIVE_EVERY = 4;

/**
 * Buổi từ 30 phút có đủ mạch: Mục tiêu, Mục lục và slide mở mỗi phần. Buổi 15 phút chỉ có 8–10 slide,
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
  maxSlides: 40,
  partName: 120,
  maxParts: 20,
} as const;

export function slideRange(minutes: number): { min: number; max: number } {
  const d = DURATIONS.find((x) => x.minutes === minutes) ?? DURATIONS[1];
  return { min: d.min, max: d.max };
}

export function isValidMinutes(m: unknown): m is 15 | 30 | 45 {
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

function sanitizeSlide(raw: unknown, idFallback = newOutlineId): OutlineSlide | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const kind: OutlineKind = OUTLINE_KINDS.includes(o.kind as OutlineKind) ? (o.kind as OutlineKind) : "content";
  const title = clean(o.title, OUTLINE_LIMITS.slideTitle);
  const part = typeof o.partId === "string" && o.partId ? { partId: o.partId.slice(0, 60) } : {};
  if (kind === "content") {
    const layout: OutlineLayout = OUTLINE_LAYOUTS.includes(o.layout as OutlineLayout) ? (o.layout as OutlineLayout) : "image";
    const points = (Array.isArray(o.points) ? o.points : [])
      .map((p) => clean(p, OUTLINE_LIMITS.point))
      .filter(Boolean)
      .slice(0, OUTLINE_LIMITS.points);
    return { id: typeof o.id === "string" && o.id ? o.id.slice(0, 60) : idFallback(), ...part, kind, layout, title, points };
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
 * Chia dàn ý chưa có phần (dàn ý tạo trước khi có mạch cấu trúc, hoặc mô hình không gán vai trò):
 * Bìa đầu bài; mỗi slide "Mở phần" mở một phần Nội dung mang tên slide đó; slide Tóm tắt cuối và các
 * slide sau nó vào Tổng kết; phần còn lại vào phần Nội dung đang mở.
 */
export function inferParts(o: Pick<Outline, "title" | "slides">): Outline {
  const parts: OutlinePart[] = [];
  const slides = o.slides.map((s) => ({ ...s }));
  let lastContent = -1;
  slides.forEach((s, i) => {
    if (s.kind === "content") lastContent = i;
  });
  let cur: OutlinePart | null = null;
  const open = (role: PartRole, name = "") => {
    cur = { id: newPartId(), role, name };
    parts.push(cur);
  };
  slides.forEach((s, i) => {
    if (i === 0 && s.kind === "content" && s.layout === "cover") open("cover");
    else if (isOpener(s)) open("content", s.title);
    else if (i === lastContent && i > 0 && s.layout === "summary") open("summary");
    else if (!cur || cur.role === "cover") open("content");
    s.partId = cur!.id;
  });
  const unnamed = parts.filter((p) => p.role === "content" && !p.name);
  const contentCount = parts.filter((p) => p.role === "content").length;
  unnamed.forEach((p, k) => {
    p.name = contentCount === 1 ? "Nội dung chính" : `Phần ${k + 1}`;
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

/** Nhãn phần như trong dàn ý: "Hook", "Nội dung 2: Ứng dụng AR trong lớp học". */
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
export function normalizeOutline(raw: unknown, minutes: number, sourceText?: string): { outline: Outline; warnings: string[] } {
  const warnings: string[] = [];
  const pre = partsFromRaw(raw);
  let outline = sanitizeOutline(pre.value);
  if (sourceText !== undefined) warnings.push(...demoteUnbackedCharts(outline, sourceText));
  const { min, max } = slideRange(minutes);

  if (outline.slides.length > max) {
    const had = outline.slides.length;
    const last = outline.slides[had - 1]!;
    outline.slides = [...outline.slides.slice(0, max - 1), last];
    warnings.push(`AI đề xuất ${had} slide, đã giữ ${max} slide cho buổi ${minutes} phút. Bạn có thể thêm lại slide ở bước này.`);
  }

  const first = outline.slides[0];
  if (first && first.kind === "content" && first.layout !== "cover") first.layout = "cover";
  const lastContent = [...outline.slides].reverse().find((s) => s.kind === "content");
  if (lastContent && lastContent !== first && lastContent.layout !== "summary") lastContent.layout = "summary";
  // Mô hình không gán vai trò: chia lại sau khi đã ép bìa/tóm tắt, để hai slide đó vào đúng phần.
  outline = finalizeParts(pre.fromRoles ? outline : inferParts(outline));

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

  warnings.push(...outlineWarnings(outline, minutes).filter((w) => !warnings.includes(w)));
  return { outline, warnings };
}

/**
 * Chống bịa số liệu ngay từ dàn ý: slide Biểu đồ cần ít nhất hai ý có số, và mọi số đó phải có trong
 * tài liệu gốc. Không đạt thì đổi sang Chữ và hình (giữ nguyên các ý) và báo cho giảng viên.
 * Sửa tại chỗ; trả về các câu cảnh báo.
 */
export function demoteUnbackedCharts(outline: Pick<Outline, "slides">, sourceText: string): string[] {
  const found = numbersInText(sourceText);
  const warnings: string[] = [];
  for (const s of outline.slides) {
    if (s.kind !== "content" || s.layout !== "chart") continue;
    const withNum = s.points.filter((p) => /\d/.test(p));
    if (withNum.length >= 2 && withNum.every((p) => cellNumbersInSource(p.replace(/^[^:]*:\s*/, ""), found))) continue;
    s.layout = "image";
    warnings.push(`Slide “${s.title || "không tên"}”: tài liệu không có đủ số liệu cho biểu đồ, đã đổi sang Chữ và hình.`);
  }
  return warnings;
}

export function outlineStats(outline: Pick<Outline, "slides"> & { title?: string }): { total: number; content: number; interactive: number } {
  const interactive = outline.slides.filter((s) => s.kind !== "content").length;
  return { total: outline.slides.length, content: outline.slides.length - interactive, interactive };
}

/** Điểm lệch so với khuyến nghị — chỉ nhắc, không chặn (giảng viên là người quyết). */
export function outlineWarnings(outline: Pick<Outline, "slides"> & { title?: string }, minutes: number): string[] {
  const w: string[] = [];
  const { min, max } = slideRange(minutes);
  const st = outlineStats(outline);
  if (st.total < min) w.push(`Dàn ý có ${st.total} slide, ít hơn mức gợi ý ${min} đến ${max} slide cho buổi ${minutes} phút.`);
  if (st.total > max && !w.length) w.push(`Dàn ý có ${st.total} slide, nhiều hơn mức gợi ý ${min} đến ${max} slide cho buổi ${minutes} phút.`);
  if (st.interactive === 0 && st.total >= 6) w.push("Dàn ý chưa có slide tương tác nào (trắc nghiệm, bình chọn, đám mây từ hoặc bảng cộng tác).");
  for (let i = 1; i < outline.slides.length; i++) {
    if (outline.slides[i]!.kind !== "content" && outline.slides[i - 1]!.kind !== "content") {
      w.push("Có hai slide tương tác liền nhau; nên xen slide nội dung ở giữa.");
      break;
    }
  }
  const last = outline.slides[outline.slides.length - 1];
  if (last && last.kind !== "content") w.push("Slide cuối đang là slide tương tác; nên kết bài bằng slide tóm tắt.");
  return w;
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
