// Bước 3 của "tài liệu → bài giảng tương tác": biến dàn ý đã chốt thành slide.
// Module thuần + bộ điều phối có tiêm phụ thuộc (không DB, không mô hình) để test được.
// Không tin đầu ra mô hình: mọi bản nháp đi qua draftToSlide; thiếu hoặc hỏng thì rơi về
// nội dung dựng thẳng từ dàn ý, để giảng viên không bao giờ nhận slide rỗng.

import {
  ITEM_RANGE,
  MAX_LEN,
  normalizeContentSlideConfig,
  sanitizeLayoutConfig,
  type SlideLayoutId,
} from "./limioLiveSlides";
import { stripEmoji, type OutlineSlide } from "./limioLiveOutline";

export const BATCH_SIZE = 5;

/** Bản nháp thô của một slide do mô hình viết (cùng hình dạng với core-feedback RawSlideDraft). */
export interface SlideDraft {
  index: number;
  title?: string;
  subtitle?: string;
  byline?: string;
  sectionNumber?: string;
  bullets?: string[];
  items?: Array<{ heading?: string; body?: string; icon?: string }>;
  columns?: Array<{ heading?: string; tone?: string; points?: string[]; note?: string }>;
  footnote?: string;
  quote?: string;
  source?: string;
  question?: string;
  options?: Array<{ text?: string; correct?: boolean }>;
  prompt?: string;
  notes?: string;
}

export interface GeneratedSlide {
  type: "content" | "quiz" | "poll" | "word_cloud";
  config: Record<string, unknown>;
  /** true = nội dung dựng từ dàn ý vì bản nháp của AI thiếu hoặc hỏng. */
  usedFallback: boolean;
}

export function makeBatches(total: number, size = BATCH_SIZE): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < total; i += size) out.push(Array.from({ length: Math.min(size, total - i) }, (_, k) => i + k));
  return out;
}

/** Bỏ emoji ở mọi chuỗi lồng nhau (tiêu chí G6) — áp cho mọi thứ do AI viết. */
export function deepStripEmoji<T>(v: T): T {
  if (typeof v === "string") return stripEmoji(v) as unknown as T;
  if (Array.isArray(v)) return v.map((x) => deepStripEmoji(x)) as unknown as T;
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, deepStripEmoji(x)])) as unknown as T;
  }
  return v;
}

const splitHeading = (p: string): { heading: string; body: string } => {
  const i = p.indexOf(": ");
  return i > 0 && i < 80 ? { heading: p.slice(0, i).trim(), body: p.slice(i + 2).trim() } : { heading: p.trim(), body: "" };
};

function metaFor(os: OutlineSlide, notes: string | undefined): Record<string, unknown> {
  const n = typeof notes === "string" ? stripEmoji(notes).slice(0, MAX_LEN.notes) : "";
  return { outlineId: os.id, aiGenerated: true, ...(n ? { presenterNote: n } : {}) };
}

/** Nội dung dựng thẳng từ dàn ý — dùng khi bản nháp AI thiếu hoặc hỏng. */
export function configFromOutline(os: OutlineSlide, sectionNo: string, notes?: string): GeneratedSlide {
  const meta = metaFor(os, notes);
  const pts = os.points;
  if (os.kind === "quiz" || os.kind === "poll") {
    return {
      type: os.kind,
      config: {
        question: os.title,
        options: os.kind === "quiz" ? [{ text: "", correct: true }, { text: "", correct: false }] : [{ text: "" }, { text: "" }],
        ...meta,
      },
      usedFallback: true,
    };
  }
  if (os.kind === "word_cloud") return { type: "word_cloud", config: { prompt: os.title, ...meta }, usedFallback: true };

  let layout: SlideLayoutId = os.layout ?? "image";
  const raw: Record<string, unknown> = { title: os.title };
  const items = pts.map(splitHeading);
  if (layout === "stats") {
    const withNum = items.map((it, i) => ({ num: /\d[\d.,%]*/.exec(pts[i] ?? "")?.[0] ?? "", it }));
    if (withNum.filter((x) => x.num).length >= ITEM_RANGE.stats!.min) {
      raw.items = withNum.filter((x) => x.num).map((x) => ({ heading: x.num, body: x.it.body || x.it.heading }));
    } else layout = "cards";
  }
  switch (layout) {
    case "cover":
      raw.subtitle = pts[0] ?? "";
      break;
    case "section":
      raw.sectionNumber = sectionNo;
      raw.subtitle = pts[0] ?? "";
      break;
    case "image":
      raw.bullets = pts;
      break;
    case "cards":
    case "steps":
      raw.items = items;
      break;
    case "summary":
      raw.items = pts.map((p) => ({ heading: p }));
      break;
    case "compare":
      raw.columns = items.slice(0, 2).map((it, i) => ({
        heading: it.heading,
        tone: i === 0 ? "bad" : "good",
        points: it.body ? [it.body] : [],
        note: "",
      }));
      break;
    case "quote":
      raw.quote = pts[0] ?? os.title;
      break;
    default:
      break;
  }
  const config = { ...sanitizeLayoutConfig(layout, raw), ...meta };
  return { type: "content", config: normalizeContentSlideConfig(config) as Record<string, unknown>, usedFallback: true };
}

const nonEmpty = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

/** Bản nháp đủ dùng cho bố cục này chưa? (sau khi lọc) */
function contentComplete(layout: SlideLayoutId, c: Record<string, any>): boolean {
  if (layout === "quote") return nonEmpty(c.quote);
  if (!nonEmpty(c.title)) return false;
  const range = ITEM_RANGE[layout];
  if (range) {
    const items: Array<{ heading: string; body: string }> = Array.isArray(c.items) ? c.items : [];
    if (items.length < range.min) return false;
    if (layout === "summary") return items.every((i) => nonEmpty(i.heading));
    return items.every((i) => nonEmpty(i.heading) && (layout === "stats" || nonEmpty(i.body)));
  }
  if (layout === "compare") {
    const cols: Array<{ heading: string; points: string[] }> = Array.isArray(c.columns) ? c.columns : [];
    return cols.length === 2 && cols.every((x) => nonEmpty(x.heading) && x.points.length >= 1);
  }
  if (layout === "image") return Array.isArray(c.bullets) && c.bullets.length >= 1;
  if (layout === "cover" || layout === "section") return nonEmpty(c.subtitle);
  return true;
}

/** Biến bản nháp AI của một dòng dàn ý thành slide; hỏng thì rơi về dàn ý. */
export function draftToSlide(os: OutlineSlide, draftIn: SlideDraft | undefined, sectionNo: string): GeneratedSlide {
  if (!draftIn || typeof draftIn !== "object") return configFromOutline(os, sectionNo);
  const d = deepStripEmoji(draftIn);
  const meta = metaFor(os, d.notes);

  if (os.kind === "quiz" || os.kind === "poll") {
    const opts = (Array.isArray(d.options) ? d.options : [])
      .map((o) => ({ text: typeof o?.text === "string" ? o.text.trim().slice(0, 160) : "", correct: o?.correct === true }))
      .filter((o) => o.text);
    const q = nonEmpty(d.question) ? d.question.trim().slice(0, 300) : "";
    if (os.kind === "quiz") {
      const correct = opts.filter((o) => o.correct).length;
      if (!q || opts.length < 2 || opts.length > 6 || correct !== 1) return configFromOutline(os, sectionNo, d.notes);
      return { type: "quiz", config: { question: q, options: opts, ...meta }, usedFallback: false };
    }
    if (!q || opts.length < 2 || opts.length > 6) return configFromOutline(os, sectionNo, d.notes);
    return { type: "poll", config: { question: q, options: opts.map((o) => ({ text: o.text })), ...meta }, usedFallback: false };
  }
  if (os.kind === "word_cloud") {
    const p = nonEmpty(d.prompt) ? d.prompt.trim().slice(0, 300) : "";
    if (!p) return configFromOutline(os, sectionNo, d.notes);
    return { type: "word_cloud", config: { prompt: p, ...meta }, usedFallback: false };
  }

  const layout: SlideLayoutId = os.layout ?? "image";
  const raw: Record<string, unknown> = { ...d, sectionNumber: layout === "section" ? sectionNo : d.sectionNumber, byline: "" /* tên giảng viên và lớp do giảng viên tự điền, AI không được bịa */ };
  const clean = sanitizeLayoutConfig(layout, raw) as Record<string, any>;
  if (!contentComplete(layout, clean)) return configFromOutline(os, sectionNo, d.notes);
  return {
    type: "content",
    config: normalizeContentSlideConfig({ ...clean, ...meta }) as Record<string, unknown>,
    usedFallback: false,
  };
}

/** Số mục: "01", "02"... theo thứ tự các slide bố cục "section" trong dàn ý. */
export function sectionNumbers(slides: OutlineSlide[]): string[] {
  let n = 0;
  return slides.map((s) => (s.kind === "content" && s.layout === "section" ? String(++n).padStart(2, "0") : ""));
}

/** Ước lượng token cho cả lần sinh: hiện cho giảng viên trước khi bấm (tiêu chí L7). */
export function estimateGenerationTokens(o: { sourceChars: number; slideCount: number }): { input: number; output: number; total: number } {
  const batches = Math.max(1, Math.ceil(o.slideCount / BATCH_SIZE));
  const perBatchInput = 1600 + Math.round(Math.min(o.sourceChars, 24_000) / 2.4);
  const input = batches * perBatchInput;
  const output = o.slideCount * 420;
  return { input, output, total: input + output };
}

export interface GenerateDeps {
  outline: OutlineSlide[];
  /** Gọi mô hình cho một lô chỉ số; ném lỗi nếu hỏng. */
  generateBatch: (indices: number[]) => Promise<SlideDraft[]>;
  /** Lỗi không nên thử lại hay che bằng nội dung dự phòng (vd. hết hạn mức): dừng cả quá trình. */
  isFatal: (e: unknown) => boolean;
  onProgress?: (done: number, total: number) => void;
  concurrency?: number;
}

export interface GenerateResult {
  slides: GeneratedSlide[];
  fallbackCount: number;
}

/**
 * Sinh nội dung mọi slide theo lô, tối đa `concurrency` lô song song, giữ nguyên thứ tự dàn ý.
 * Lô hỏng được thử lại một lần; vẫn hỏng thì dùng nội dung dựng từ dàn ý (usedFallback).
 * Lỗi "fatal" (hết hạn mức) ném ra ngay — không tạo slide nào.
 */
export async function generateDeckSlides(deps: GenerateDeps): Promise<GenerateResult> {
  const { outline } = deps;
  const total = outline.length;
  const sections = sectionNumbers(outline);
  const results: GeneratedSlide[] = new Array(total);
  const batches = makeBatches(total);
  let done = 0;
  let cursor = 0;
  let fatal: unknown = null;

  const runBatch = async (indices: number[]) => {
    let drafts: SlideDraft[] | null = null;
    for (let attempt = 0; attempt < 2 && !drafts; attempt++) {
      try {
        drafts = await deps.generateBatch(indices);
      } catch (e) {
        if (deps.isFatal(e)) throw e;
      }
    }
    const byIndex = new Map((drafts ?? []).map((x) => [x.index, x]));
    for (const i of indices) results[i] = draftToSlide(outline[i]!, byIndex.get(i), sections[i]!);
    done += indices.length;
    deps.onProgress?.(done, total);
  };

  const worker = async () => {
    while (!fatal) {
      const mine = cursor++;
      if (mine >= batches.length) return;
      try {
        await runBatch(batches[mine]!);
      } catch (e) {
        fatal = e;
        return;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(deps.concurrency ?? 2, batches.length) }, worker));
  if (fatal) throw fatal;

  return { slides: results, fallbackCount: results.filter((r) => r.usedFallback).length };
}
