// Bước 3 của "tài liệu → bài giảng tương tác": biến dàn ý đã chốt thành slide.
// Module thuần + bộ điều phối có tiêm phụ thuộc (không DB, không mô hình) để test được.
// Không tin đầu ra mô hình: mọi bản nháp đi qua draftToSlide; thiếu hoặc hỏng thì rơi về
// nội dung dựng thẳng từ dàn ý, để giảng viên không bao giờ nhận slide rỗng.

import {
  ITEM_RANGE,
  MAX_LEN,
  normalizeContentSlideConfig,
  pickMeta,
  resolveLayout,
  sanitizeLayoutConfig,
  type SlideLayoutId,
} from "./limioLiveSlides";
import { safeLayoutFor, stripEmoji, type DeckSourceKind, type OutlineSlide, type SlideStructure, type WebSourceRef } from "./limioLiveOutline";
import { allText, formatCite, stripCitesDeep, unsupportedFigures } from "./limioLiveFigures";

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
  type: "content" | "quiz" | "poll" | "word_cloud" | "collaborate_board" | "whiteboard";
  config: Record<string, unknown>;
  /** true = nội dung dựng từ dàn ý vì bản nháp của AI thiếu hoặc hỏng. */
  usedFallback: boolean;
}

/**
 * Nguồn của bài khi tạo slide. Bỏ trống = tài liệu (hành vi cũ). Bài từ mô tả chủ đề: đổi bố cục bị cấm,
 * loại con số kiểu thống kê không có trong dàn ý hoặc nguồn, và (mức có nguồn) gom số [n] thành dòng nguồn ở chân slide.
 */
export interface DraftContext {
  sourceKind?: DeckSourceKind;
  /** Văn bản nguồn của bài (mô tả, hoặc mô tả kèm các trang đã đọc). */
  sourceText?: string;
  refs?: WebSourceRef[];
  /** Văn bản khác giảng viên đã thấy và chấp nhận (vd. nội dung slide hiện tại khi nhờ AI sửa). */
  extraCorpus?: string;
}

const topicKind = (ctx?: DraftContext): DeckSourceKind => ctx?.sourceKind ?? "document";

/** Dòng dàn ý với bố cục đã đổi theo nguồn (mức kiến thức chung không có Số liệu, Trích dẫn). */
function forSource(os: OutlineSlide, ctx?: DraftContext): OutlineSlide {
  const layout = safeLayoutFor(topicKind(ctx), os.layout);
  return layout === os.layout ? os : { ...os, layout };
}

/** Gỡ số nguồn [n] khỏi chữ; mức có nguồn thì trả dòng chân slide tương ứng. */
function takeCites<T>(v: T, ctx?: DraftContext): { value: T; cite: string } {
  if (topicKind(ctx) === "document") return { value: v, cite: "" };
  const nums: number[] = [];
  const value = stripCitesDeep(v, nums);
  return { value, cite: topicKind(ctx) === "topic_web" ? formatCite(nums, ctx?.refs?.length ?? 0) : "" };
}

/** Slide Nguồn tham khảo: đúng chữ của dàn ý; ghi chú giảng liệt kê địa chỉ đầy đủ để giảng viên mở kiểm tra. */
function referencesSlide(os: OutlineSlide, ctx?: DraftContext): GeneratedSlide {
  const refs = ctx?.refs ?? [];
  const note = refs.length ? `Các trang AI đã đọc khi soạn bài:\n${refs.map((r) => `[${r.n}] ${r.title} — ${r.url}`).join("\n")}` : "";
  const config = {
    ...sanitizeLayoutConfig("summary", { title: os.title, items: os.points.map((p) => ({ heading: p })) }),
    outlineId: os.id,
    aiGenerated: true,
    ...(note ? { presenterNote: note.slice(0, MAX_LEN.notes) } : {}),
  };
  return { type: "content", config: normalizeContentSlideConfig(config) as Record<string, unknown>, usedFallback: false };
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

/**
 * Slide cộng tác: chỉ cần một câu gợi ý. Dán Note và Draw-it cùng là collaborate_board (Draw-it có mode "drawing");
 * bảng và whiteboard thật được liên kết lúc trình chiếu, nên ở đây chỉ ghi cấu hình như bộ chọn loại slide.
 */
function collabSlide(os: OutlineSlide, text: string, meta: Record<string, unknown>, usedFallback: boolean): GeneratedSlide {
  if (os.kind === "whiteboard") return { type: "whiteboard", config: { title: text, ...meta }, usedFallback };
  return {
    type: "collaborate_board",
    config: { prompt: text, mode: os.kind === "draw_it" ? "drawing" : "free", allowViewOthers: true, blockPaste: false, ...meta },
    usedFallback,
  };
}
const isCollab = (k: OutlineSlide["kind"]) => k === "collaborate_board" || k === "draw_it" || k === "whiteboard";

const splitHeading = (p: string): { heading: string; body: string } => {
  const i = p.indexOf(": ");
  return i > 0 && i < 80 ? { heading: p.slice(0, i).trim(), body: p.slice(i + 2).trim() } : { heading: p.trim(), body: "" };
};

function metaFor(os: OutlineSlide, notes: string | undefined): Record<string, unknown> {
  const n = typeof notes === "string" ? stripEmoji(notes).slice(0, MAX_LEN.notes) : "";
  return { outlineId: os.id, aiGenerated: true, ...(n ? { presenterNote: n } : {}) };
}

/** Nội dung dựng thẳng từ dàn ý — dùng khi bản nháp AI thiếu hoặc hỏng. */
export function configFromOutline(osIn: OutlineSlide, sectionNo: string, notes?: string, ctx?: DraftContext): GeneratedSlide {
  if (osIn.fixed === "references") return referencesSlide(osIn, ctx);
  const cited = takeCites({ title: osIn.title, points: osIn.points }, ctx);
  const os = { ...forSource(osIn, ctx), ...cited.value };
  const meta = { ...metaFor(os, notes), ...(cited.cite ? { cite: cited.cite } : {}) };
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
  if (isCollab(os.kind)) return collabSlide(os, os.title, meta, true);

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
export function draftToSlide(osIn: OutlineSlide, draftIn: SlideDraft | undefined, sectionNo: string, ctx?: DraftContext): GeneratedSlide {
  if (osIn.fixed === "references") return referencesSlide(osIn, ctx);
  if (!draftIn || typeof draftIn !== "object") return configFromOutline(osIn, sectionNo, undefined, ctx);
  const os = forSource(osIn, ctx);
  const fallback = (notes?: string) => configFromOutline(osIn, sectionNo, notes, ctx);
  const cited = takeCites(deepStripEmoji(draftIn), ctx);
  const d = cited.value;
  // Bài không có tài liệu: con số kiểu thống kê phải có trong dàn ý đã chốt, văn bản nguồn hoặc nội dung giảng viên đã có.
  if (topicKind(ctx) !== "document") {
    const corpus = [osIn.title, ...osIn.points, ctx?.sourceText ?? "", ctx?.extraCorpus ?? ""].join("\n");
    if (unsupportedFigures(allText({ ...d, notes: "" }), corpus).length) return fallback(d.notes);
  }
  const meta = { ...metaFor(os, d.notes), ...(cited.cite ? { cite: cited.cite } : {}) };

  if (os.kind === "quiz" || os.kind === "poll") {
    const opts = (Array.isArray(d.options) ? d.options : [])
      .map((o) => ({ text: typeof o?.text === "string" ? o.text.trim().slice(0, 160) : "", correct: o?.correct === true }))
      .filter((o) => o.text);
    const q = nonEmpty(d.question) ? d.question.trim().slice(0, 300) : "";
    if (os.kind === "quiz") {
      const correct = opts.filter((o) => o.correct).length;
      if (!q || opts.length < 2 || opts.length > 6 || correct !== 1) return fallback(d.notes);
      return { type: "quiz", config: { question: q, options: opts, ...meta }, usedFallback: false };
    }
    if (!q || opts.length < 2 || opts.length > 6) return fallback(d.notes);
    return { type: "poll", config: { question: q, options: opts.map((o) => ({ text: o.text })), ...meta }, usedFallback: false };
  }
  if (os.kind === "word_cloud") {
    const p = nonEmpty(d.prompt) ? d.prompt.trim().slice(0, 300) : "";
    if (!p) return fallback(d.notes);
    return { type: "word_cloud", config: { prompt: p, ...meta }, usedFallback: false };
  }
  if (isCollab(os.kind)) {
    const p = nonEmpty(d.prompt) ? d.prompt.trim().slice(0, 300) : "";
    if (!p) return fallback(d.notes);
    return collabSlide(os, p, meta, false);
  }

  const layout: SlideLayoutId = os.layout ?? "image";
  const raw: Record<string, unknown> = { ...d, sectionNumber: layout === "section" ? sectionNo : d.sectionNumber, byline: "" /* tên giảng viên và lớp do giảng viên tự điền, AI không được bịa */ };
  const clean = sanitizeLayoutConfig(layout, raw) as Record<string, any>;
  if (!contentComplete(layout, clean)) return fallback(d.notes);
  return {
    type: "content",
    config: normalizeContentSlideConfig({ ...clean, ...meta }) as Record<string, unknown>,
    usedFallback: false,
  };
}

/**
 * Chữ do mạch cấu trúc quyết định, ghi đè bản AI viết: slide mở phần nhận số phần, tên phần và mục lục;
 * slide Mục lục nhận đúng tên các phần. Nhờ vậy số và tên luôn khớp nhau giữa các slide.
 */
export function applyStructure(g: GeneratedSlide, st: SlideStructure | null | undefined): GeneratedSlide {
  if (!st || g.type !== "content") return g;
  const c = g.config;
  if (c.layout === "section" && st.toc) {
    const cur = st.tocCurrent ?? 0;
    const config = { ...c, sectionNumber: st.sectionNo ?? c.sectionNumber, toc: st.toc, tocCurrent: cur, title: st.toc[cur - 1] || c.title };
    return { ...g, config: normalizeContentSlideConfig(config) as Record<string, unknown> };
  }
  if (c.layout === "summary" && st.agenda && st.agenda.length) {
    return { ...g, config: { ...c, items: st.agenda.map((h) => ({ heading: h.slice(0, MAX_LEN.itemHeading), body: "" })) } };
  }
  return g;
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
  /** Số mục theo toàn bộ dàn ý, thẳng hàng với `outline` (khi chỉ viết một phần dàn ý). */
  sectionNos?: string[];
  /** Thông tin mạch cấu trúc thẳng hàng với `outline` (slideStructures); thiếu thì bỏ qua. */
  structures?: Array<SlideStructure | null>;
  /** Nguồn của bài (mô tả chủ đề...); thiếu = tài liệu. */
  context?: DraftContext;
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
  const sections = deps.sectionNos ?? sectionNumbers(outline);
  const results: GeneratedSlide[] = new Array(total);
  // Dòng do hệ thống dựng (Nguồn tham khảo) không gửi cho AI.
  const ai = outline.map((s, i) => (s.fixed ? -1 : i)).filter((i) => i >= 0);
  outline.forEach((s, i) => {
    if (s.fixed) results[i] = applyStructure(draftToSlide(s, undefined, sections[i]!, deps.context), deps.structures?.[i]);
  });
  let done = total - ai.length;
  const batches = makeBatches(ai.length).map((b) => b.map((k) => ai[k]!));
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
    for (const i of indices) results[i] = applyStructure(draftToSlide(outline[i]!, byIndex.get(i), sections[i]!, deps.context), deps.structures?.[i]);
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

// ── Đề xuất sửa MỘT slide bằng AI (tiêu chí H8–H10) ─────────────────────────

/** "custom" = yêu cầu riêng giảng viên gõ ở tab Nhờ AI. */
export type SlideEditAction = "shorter" | "example" | "simpler" | "to_quiz" | "rewrite" | "custom";
export const SLIDE_EDIT_ACTIONS: readonly SlideEditAction[] = ["shorter", "example", "simpler", "to_quiz", "rewrite", "custom"];

/** Các khoá meta của slide hiện tại không được AI đổi; phần còn lại là nội dung. */
const GENERATED_META = ["outlineId", "aiGenerated", "presenterNote"] as const;

/**
 * Biến bản nháp AI thành ĐỀ XUẤT thay cho slide hiện tại. Đi qua cùng bộ kiểm tra như lúc sinh
 * slide (draftToSlide); nháp hỏng thì trả null — khác với lúc sinh, ở đây KHÔNG rơi về nội dung
 * dựng sẵn vì giảng viên đã có slide tốt hơn để giữ. Ghi chú giảng và dấu vết (ẩn, dòng dàn ý,
 * AI sinh, đã sửa tay) của slide cũ được giữ; chỉ "đổi thành quiz" lấy ghi chú mới khi slide cũ chưa có.
 */
export function proposalFromDraft(
  action: SlideEditAction,
  current: { config: Record<string, unknown> },
  draft: SlideDraft | undefined,
  ctx?: DraftContext,
): { type: "content" | "quiz"; config: Record<string, unknown> } | null {
  const cfg = current.config;
  const toQuiz = action === "to_quiz";
  const os: OutlineSlide = {
    id: typeof cfg.outlineId === "string" ? cfg.outlineId : "edit",
    kind: toQuiz ? "quiz" : "content",
    layout: toQuiz ? null : (resolveLayout(cfg) === "classic" ? "image" : (resolveLayout(cfg) as Exclude<SlideLayoutId, "classic">)),
    title: typeof cfg.title === "string" ? cfg.title : "",
    points: [],
  };
  const sectionNo = typeof cfg.sectionNumber === "string" ? cfg.sectionNumber : "";
  // Nội dung slide hiện tại là thứ giảng viên đã có: con số trong đó không bị coi là bịa.
  const g = draftToSlide(os, draft, sectionNo, ctx && { ...ctx, extraCorpus: allText(cfg) });
  if (g.usedFallback) return null;

  const content: Record<string, unknown> = { ...g.config };
  const aiNote = content.presenterNote;
  for (const k of GENERATED_META) delete content[k];
  const meta = pickMeta(cfg);
  // Dòng nguồn theo nội dung mới: bản mới có nguồn thì thay, không có thì bỏ dòng cũ (bài mức có nguồn).
  if (ctx?.sourceKind === "topic_web") delete meta.cite;
  const note = meta.presenterNote ?? aiNote;
  return {
    type: toQuiz ? "quiz" : "content",
    config: { ...content, ...meta, ...(note ? { presenterNote: note } : {}) },
  };
}
