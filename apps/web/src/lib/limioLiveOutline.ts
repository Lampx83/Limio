// Dàn ý bài giảng tương tác sinh từ tài liệu (bước giữa "tài liệu gốc" và "slide cuối").
// Module thuần: chuẩn hoá đầu ra của mô hình AI và kiểm tra dàn ý giảng viên sửa.
// Không tin thẳng đầu ra mô hình: số slide, bố cục, độ dài, emoji đều được ép ở đây.

import { SLIDE_LAYOUTS, type SlideLayoutId } from "./limioLiveSlides";

export type OutlineKind = "content" | "quiz" | "poll" | "word_cloud";
export const OUTLINE_KINDS: readonly OutlineKind[] = ["content", "quiz", "poll", "word_cloud"];

/** Bố cục dùng được trong dàn ý (không gồm "classic" — chỉ dành cho slide cũ). */
export type OutlineLayout = Exclude<SlideLayoutId, "classic">;
export const OUTLINE_LAYOUTS = SLIDE_LAYOUTS.filter((l): l is OutlineLayout => l !== "classic");

export interface OutlineSlide {
  id: string;
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
}

/** Thời lượng buổi giảng → khoảng số slide hợp lý (tiêu chí L3). */
export const DURATIONS = [
  { minutes: 15, min: 8, max: 10 },
  { minutes: 30, min: 14, max: 18 },
  { minutes: 45, min: 20, max: 25 },
] as const;

/** Cứ bấy nhiêu slide nội dung thì có một slide tương tác. */
export const INTERACTIVE_EVERY = 4;

export const OUTLINE_LIMITS = {
  title: 120,
  slideTitle: 200,
  point: 200,
  points: 5,
  maxSlides: 40,
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

function sanitizeSlide(raw: unknown, idFallback = newOutlineId): OutlineSlide | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const kind: OutlineKind = OUTLINE_KINDS.includes(o.kind as OutlineKind) ? (o.kind as OutlineKind) : "content";
  const title = clean(o.title, OUTLINE_LIMITS.slideTitle);
  if (kind === "content") {
    const layout: OutlineLayout = OUTLINE_LAYOUTS.includes(o.layout as OutlineLayout) ? (o.layout as OutlineLayout) : "image";
    const points = (Array.isArray(o.points) ? o.points : [])
      .map((p) => clean(p, OUTLINE_LIMITS.point))
      .filter(Boolean)
      .slice(0, OUTLINE_LIMITS.points);
    return { id: typeof o.id === "string" && o.id ? o.id.slice(0, 60) : idFallback(), kind, layout, title, points };
  }
  return { id: typeof o.id === "string" && o.id ? o.id.slice(0, 60) : idFallback(), kind, layout: null, title, points: [] };
}

/** Lưu dàn ý do giảng viên sửa: lọc trường, cắt độ dài, giữ id. Slide rỗng hoàn toàn bị bỏ. */
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
  return { title: clean(o.title, OUTLINE_LIMITS.title), slides };
}

/**
 * Chuẩn hoá đầu ra thô của mô hình thành dàn ý hợp lệ cho thời lượng đã chọn.
 * - ép slide đầu là bìa, slide nội dung cuối là tóm tắt;
 * - quá nhiều slide thì giữ phần đầu và slide cuối;
 * - trả kèm cảnh báo để giao diện nói rõ với giảng viên những gì đã chỉnh hoặc còn lệch.
 */
export function normalizeOutline(raw: unknown, minutes: number): { outline: Outline; warnings: string[] } {
  const warnings: string[] = [];
  const outline = sanitizeOutline(raw);
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

  warnings.push(...outlineWarnings(outline, minutes).filter((w) => !warnings.includes(w)));
  return { outline, warnings };
}

export function outlineStats(outline: Outline): { total: number; content: number; interactive: number } {
  const interactive = outline.slides.filter((s) => s.kind !== "content").length;
  return { total: outline.slides.length, content: outline.slides.length - interactive, interactive };
}

/** Điểm lệch so với khuyến nghị — chỉ nhắc, không chặn (giảng viên là người quyết). */
export function outlineWarnings(outline: Outline, minutes: number): string[] {
  const w: string[] = [];
  const { min, max } = slideRange(minutes);
  const st = outlineStats(outline);
  if (st.total < min) w.push(`Dàn ý có ${st.total} slide, ít hơn mức gợi ý ${min} đến ${max} slide cho buổi ${minutes} phút.`);
  if (st.total > max && !w.length) w.push(`Dàn ý có ${st.total} slide, nhiều hơn mức gợi ý ${min} đến ${max} slide cho buổi ${minutes} phút.`);
  if (st.interactive === 0 && st.total >= 6) w.push("Dàn ý chưa có slide tương tác nào (bài tập, bình chọn hoặc đám mây từ).");
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
export function outlineBlockingProblems(outline: Outline): string[] {
  const p: string[] = [];
  if (outline.slides.length === 0) p.push("Dàn ý chưa có slide nào.");
  outline.slides.forEach((s, i) => {
    if (!s.title.trim()) p.push(`Slide ${i + 1} chưa có ${s.kind === "content" ? "tiêu đề" : "câu hỏi"}.`);
  });
  return p;
}
