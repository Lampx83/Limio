/**
 * Đọc file Word (.docx) thành câu hỏi + đoạn văn của Đề thi — xem docs/tieu-chi/nhap-de-thi-tu-word.md.
 *
 * Thuần: không DB, không kho tệp. Trả về cả ảnh (buffer) để route tải lên ở bước nhập; xem trước không ghi gì.
 * Đọc theo khuôn, không dùng AI: cùng một file luôn ra cùng một kết quả, chữ không nhận ra thì báo chứ không đoán.
 *
 * Cách làm: mammoth đổi .docx → HTML sạch (đoạn, tiêu đề, danh sách, ảnh), sau đó một máy trạng thái nhỏ đi qua các khối:
 *   [ĐOẠN VĂN] … → gom nội dung đoạn; "Câu N." → mở câu; dòng "A." → phương án; "Đáp án:" … → đáp án; v.v.
 */
import { configSchemaForType } from "./schemas";
import type { ParsedQuestionRow } from "./import";

export const WORD_IMPORT_MAX_QUESTIONS = 200;
export const WORD_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export const WORD_IMAGE_MAX_BYTES = 5 * 1024 * 1024; // cùng trần với IMAGE_MAX_BYTES của kho đề

export type WordQuestionType = NonNullable<ParsedQuestionRow["parsed"]>["type"];

export interface WordImage {
  index: number;
  contentType: string;
  /** Mô tả ảnh: lấy từ Word nếu có, không thì "Hình minh hoạ câu N" / "… đoạn văn". Luôn không rỗng. */
  alt: string;
  data: Buffer;
  /** Lý do ảnh không dùng được (định dạng/dung lượng); có thì câu/đoạn chứa ảnh báo lỗi. */
  error?: string;
}

export interface WordPassage {
  key: string;
  title: string;
  /** HTML gồm p/h2/h3/ul/ol/strong/em/sup/sub/img; ảnh có `src="embedded:N"` (N = WordImage.index), route thay bằng đường dẫn thật. */
  html: string;
  imageIndexes: number[];
  /** Số câu hỏi thuộc đoạn (kể cả câu lỗi). */
  questionCount: number;
  error?: string;
}

export interface WordImportRow extends ParsedQuestionRow {
  /** Khoá đoạn văn trong file (WordPassage.key); null = câu độc lập. */
  passageKey: string | null;
  imageIndexes: number[];
}

export interface WordParseResult {
  passages: WordPassage[];
  rows: WordImportRow[];
  images: WordImage[];
  summary: { ok: number; warning: number; error: number; total: number };
  /** Lưu ý chung của file (đoạn văn lỗi, đoạn không có câu, quá số câu tối đa…). */
  notes: string[];
}

// ---------------------------------------------------------------------------------------------------------------------
// 1. docx → khối
// ---------------------------------------------------------------------------------------------------------------------

export type Block =
  | { kind: "p"; html: string; text: string; images: number[] }
  | { kind: "h"; level: number; html: string; text: string; images: number[] }
  | { kind: "list"; ordered: boolean; items: Array<{ html: string; text: string; images: number[] }> }
  | { kind: "table" };

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, "&");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function plainText(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<img\b[^>]*>/gi, "")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .normalize("NFC")
    .trim();
}

const KEEP_TAGS = new Set(["strong", "em", "sup", "sub", "s", "br", "u"]);

/** Giữ lại vài thẻ định dạng an toàn, bỏ phần còn lại (liên kết, span…); ảnh do hàm gọi xử lý riêng. */
function cleanInline(html: string): string {
  return html
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (m, name: string) => {
      const n = name.toLowerCase();
      if (!KEEP_TAGS.has(n)) return "";
      return m.startsWith("</") ? `</${n}>` : n === "br" ? "<br>" : `<${n}>`;
    });
}

function imageIndexesOf(html: string): number[] {
  return [...html.matchAll(/<img\b[^>]*\bsrc="embedded:(\d+)"[^>]*>/gi)].map((m) => Number(m[1]));
}

function splitBlocks(html: string): Block[] {
  const blocks: Block[] = [];
  const open = /<(p|h[1-6]|ul|ol|table)\b[^>]*>/gi;
  let pos = 0;
  while (pos < html.length) {
    open.lastIndex = pos;
    const m = open.exec(html);
    if (!m) break;
    const tag = m[1]!.toLowerCase();
    const start = m.index + m[0].length;
    // Đóng khớp (đếm lồng nhau cho ul/ol/table).
    const sameOpen = new RegExp(`<${tag}\\b[^>]*>`, "gi");
    const sameClose = new RegExp(`</${tag}>`, "gi");
    let depth = 1;
    let cursor = start;
    let end = -1;
    for (;;) {
      sameOpen.lastIndex = cursor;
      sameClose.lastIndex = cursor;
      const o = sameOpen.exec(html);
      const c = sameClose.exec(html);
      if (!c) break;
      if (o && o.index < c.index) {
        depth++;
        cursor = o.index + o[0].length;
      } else {
        depth--;
        cursor = c.index + c[0].length;
        if (depth === 0) {
          end = c.index;
          break;
        }
      }
    }
    if (end < 0) break;
    const inner = html.slice(start, end);
    pos = cursor;
    if (tag === "table") {
      blocks.push({ kind: "table" });
    } else if (tag === "ul" || tag === "ol") {
      const items = [...inner.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((li) => ({
        html: li[1]!,
        text: plainText(li[1]!),
        images: imageIndexesOf(li[1]!),
      }));
      blocks.push({ kind: "list", ordered: tag === "ol", items });
    } else if (tag === "p") {
      blocks.push({ kind: "p", html: inner, text: plainText(inner), images: imageIndexesOf(inner) });
    } else {
      blocks.push({
        kind: "h",
        level: Number(tag[1]),
        html: inner,
        text: plainText(inner),
        images: imageIndexesOf(inner),
      });
    }
  }
  return blocks;
}

// ---------------------------------------------------------------------------------------------------------------------
// 2. Nhận dạng dòng
// ---------------------------------------------------------------------------------------------------------------------

const RE_QUESTION = /^Câu\s+(\d+)\s*[.:)]\s*(.*)$/is;
const RE_PASSAGE_START = /^\[\s*ĐOẠN\s+VĂN\s*(?::\s*)?\]\s*(.*)$/is;
const RE_PASSAGE_START_INLINE = /^\[\s*ĐOẠN\s+VĂN\s*:\s*([^\]]*)\]\s*$/is;
const RE_PASSAGE_END = /^\[\s*HẾT\s+ĐOẠN\s+VĂN\s*\]/is;
const RE_OPTION = /^([A-Z])\s*[.)]\s*(.+)$/s;
const RE_LEFT = /^(\d{1,2})\s*[.)]\s*(.+)$/s;
const RE_ANSWER = /^Đáp\s*án\s*[:：]\s*(.*)$/is;
const RE_EXPLAIN = /^Giải\s*thích\s*[:：]\s*(.*)$/is;
const RE_TOLERANCE = /^Sai\s*số(?:\s*cho\s*phép)?\s*[:：]\s*(.*)$/is;
const RE_RUBRIC = /^Tiêu\s*chí(?:\s*đánh\s*giá)?(?:\s*\([^)]*\))?\s*[:：]\s*(.*)$/is;
const RE_MINWORDS = /^Số\s*từ\s*tối\s*thiểu\s*[:：]\s*(\d+)/i;
const RE_TOKEN = /^Thẻ\s*(?:\[\s*(\d+)\s*\]|(nhiễu))\s*[:：]\s*(.+)$/is;

function normTag(raw: string): string {
  return raw
    .split("·")[0]!
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const TAG_TYPES: Record<string, WordQuestionType> = {
  "mot dap an": "mcq",
  mcq: "mcq",
  "trac nghiem 1 dap an": "mcq",
  "trac nghiem mot dap an": "mcq",
  "nhieu dap an": "multi",
  multi: "multi",
  "trac nghiem nhieu dap an": "multi",
  "true false not given": "true_false_notgiven",
  tfng: "true_false_notgiven",
  "dung sai khong co thong tin": "true_false_notgiven",
  "dung sai": "true_false_notgiven",
  "dien khuyet": "gap_fill",
  "dien vao cho trong": "gap_fill",
  "gap fill": "gap_fill",
  "tra loi ngan": "short_answer",
  "short answer": "short_answer",
  "sap xep": "ordering",
  "sap xep thu tu": "ordering",
  ordering: "ordering",
  "ghep cap": "matching",
  "ghep doi": "matching",
  matching: "matching",
  "dap an dang so": "numerical",
  so: "numerical",
  "so hoc": "numerical",
  numerical: "numerical",
  "keo tha": "drag_drop_fill",
  "keo tha tu cau": "drag_drop_fill",
  "keo tha dien tu": "drag_drop_fill",
  "keo tha tu": "drag_drop_fill",
  "tu luan": "essay",
  essay: "essay",
};

// ---------------------------------------------------------------------------------------------------------------------
// 3. Máy trạng thái
// ---------------------------------------------------------------------------------------------------------------------

interface Part {
  text: string;
  html: string;
  images: number[];
}

interface Draft {
  number: number;
  points: string;
  tag: string;
  prompt: Part[];
  options: Array<{ letter: string; text: string }>;
  lefts: Array<{ n: number; text: string }>;
  tokens: Array<{ blank: number | null; label: string }>;
  answer: string | null;
  explanation: string | null;
  tolerance: string | null;
  rubric: string | null;
  minWords: number | null;
  stage: "prompt" | "options" | "after";
  passageKey: string | null;
  warnings: string[];
  errors: string[];
}

interface PassageDraft {
  key: string;
  title: string;
  parts: string[];
  imageIndexes: number[];
  questionCount: number;
}

/**
 * Đoạn/ảnh trong file: ảnh trong khối đã có sẵn thẻ <img src="embedded:N">. Ở bước này chỉ cần bảo đảm mọi thẻ đều có alt.
 */
function ensureAlt(html: string, fallback: (index: number) => void): string {
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    const idx = /\bsrc="embedded:(\d+)"/i.exec(tag)?.[1];
    if (idx === undefined) return "";
    const alt = /\balt="([^"]*)"/i.exec(tag)?.[1] ?? "";
    fallback(Number(idx));
    return `<img src="embedded:${idx}" alt="${alt}">`;
  });
}

export async function parseExamWord(buf: Buffer | Uint8Array): Promise<WordParseResult> {
  const mammoth = await import("mammoth");
  const images: WordImage[] = [];
  const converted = await mammoth.convertToHtml(
    { buffer: Buffer.isBuffer(buf) ? buf : Buffer.from(buf) },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const data = await image.read();
        const index = images.length;
        const contentType = image.contentType;
        const rec: WordImage = {
          index,
          contentType,
          alt: ((image as { altText?: string }).altText ?? "").trim(),
          data: Buffer.from(data),
        };
        if (!(WORD_IMAGE_MIME_TYPES as readonly string[]).includes(contentType)) {
          rec.error = `ảnh định dạng ${contentType.replace("image/", "").toUpperCase()} không được hỗ trợ (chỉ PNG, JPG, WebP, GIF)`;
        } else if (rec.data.length > WORD_IMAGE_MAX_BYTES) {
          rec.error = "ảnh lớn hơn 5 MB";
        }
        images.push(rec);
        return { src: `embedded:${index}`, alt: rec.alt };
      }),
    },
  );
  return interpretBlocks(splitBlocks(converted.value), images);
}

/** Tách riêng để test được bằng HTML dựng sẵn. */
export function interpretBlocks(blocks: Block[], images: WordImage[]): WordParseResult {
  const passages: PassageDraft[] = [];
  const drafts: Draft[] = [];
  const notes: string[] = [];

  let passage: PassageDraft | null = null;
  let collecting = false; // đang gom nội dung đoạn (chưa gặp "Câu" nào kể từ [ĐOẠN VĂN])
  let q: Draft | null = null;

  const altFallbackFor = new Map<number, string>();
  const setAlt = (idx: number, fb: string) => {
    if (!altFallbackFor.has(idx)) altFallbackFor.set(idx, fb);
  };

  const finish = () => {
    if (q) drafts.push(q);
    q = null;
  };

  const startPassage = (title: string) => {
    finish();
    const n = passages.length + 1;
    passage = { key: `p${n}`, title: title.trim() || `Đoạn văn ${n}`, parts: [], imageIndexes: [], questionCount: 0 };
    passages.push(passage);
    collecting = true;
  };

  const partFrom = (html: string, text: string, imgs: number[]): Part => ({ text, html, images: imgs });

  const addPassageHtml = (html: string, imgs: number[]) => {
    if (!passage) return;
    for (const i of imgs) {
      setAlt(i, "Hình minh hoạ đoạn văn");
      passage.imageIndexes.push(i);
    }
    passage.parts.push(ensureAlt(html, () => undefined));
  };

  for (const b of blocks) {
    if (b.kind === "table") continue;

    // ---- tiêu đề
    if (b.kind === "h") {
      if (b.level === 1) {
        finish();
        passage = null;
        collecting = false;
      } else if (collecting && passage && b.text) {
        addPassageHtml(`<h${Math.min(b.level, 3)}>${cleanInline(b.html)}</h${Math.min(b.level, 3)}>`, b.images);
      } else {
        finish();
      }
      continue;
    }

    // ---- danh sách
    if (b.kind === "list") {
      if (collecting && passage) {
        const tag = b.ordered ? "ol" : "ul";
        const lis = b.items.map((it) => `<li>${cleanInline(it.html)}</li>`).join("");
        addPassageHtml(`<${tag}>${lis}</${tag}>`, b.items.flatMap((it) => it.images));
      } else if (q && q.stage !== "after") {
        // Danh sách tự đánh số của Word → phương án A, B, C… (chỉ khi chưa có phương án gõ tay chiếm chữ cái).
        for (const it of b.items) {
          if (!it.text) continue;
          const letter = String.fromCharCode(65 + q.options.length);
          q.options.push({ letter, text: it.text });
        }
        q.stage = "options";
      }
      continue;
    }

    // ---- đoạn
    const text = b.text;
    const hasImg = b.images.length > 0;
    if (!text && !hasImg) continue;

    let m: RegExpExecArray | null;
    if (RE_PASSAGE_END.test(text)) {
      finish();
      passage = null;
      collecting = false;
      continue;
    }
    if ((m = RE_PASSAGE_START_INLINE.exec(text)) || (m = RE_PASSAGE_START.exec(text))) {
      startPassage(m[1] ?? "");
      continue;
    }
    if ((m = RE_QUESTION.exec(text))) {
      finish();
      collecting = false;
      const number = Number(m[1]);
      let rest = m[2] ?? "";
      let points = "";
      let tag = "";
      const pm = /^\(\s*([\d.,]+)\s*điểm\s*\)\s*/i.exec(rest);
      if (pm) {
        points = pm[1]!;
        rest = rest.slice(pm[0].length);
      }
      const tm = /^\[([^\[\]]+)\]\s*/.exec(rest);
      if (tm) {
        tag = tm[1]!.trim();
        rest = rest.slice(tm[0].length);
      }
      q = {
        number,
        points,
        tag,
        prompt: [],
        options: [],
        lefts: [],
        tokens: [],
        answer: null,
        explanation: null,
        tolerance: null,
        rubric: null,
        minWords: null,
        stage: "prompt",
        passageKey: passage ? (passage as PassageDraft).key : null,
        warnings: [],
        errors: [],
      };
      if (passage) (passage as PassageDraft).questionCount++;
      // Phần chữ của dòng "Câu N." (bỏ điểm và nhãn dạng) + ảnh trong dòng đó.
      const restHtml = stripLeadingQuestionHead(b.html);
      for (const i of b.images) setAlt(i, `Hình minh hoạ câu ${number}`);
      if (rest.trim() || hasImg) q.prompt.push(partFrom(restHtml, rest.trim(), b.images));
      continue;
    }

    if (collecting && passage) {
      for (const i of b.images) setAlt(i, "Hình minh hoạ đoạn văn");
      addPassageHtml(`<p>${cleanInline(b.html)}${imgTags(b.html)}</p>`, b.images);
      continue;
    }

    if (!q) continue; // chữ ngoài câu hỏi và đoạn văn: bỏ qua (khung ghi chú, phụ lục…)
    const cur: Draft = q;

    if ((m = RE_ANSWER.exec(text))) {
      cur.answer = m[1]!.trim();
      cur.stage = "after";
    } else if ((m = RE_EXPLAIN.exec(text))) {
      cur.explanation = m[1]!.trim();
      cur.stage = "after";
    } else if ((m = RE_TOLERANCE.exec(text))) {
      cur.tolerance = m[1]!.trim();
      cur.stage = "after";
    } else if ((m = RE_RUBRIC.exec(text))) {
      let r = m[1]!.trim();
      const mw = /\s*Số\s*từ\s*tối\s*thiểu\s*[:：]\s*(\d+)\.?\s*$/i.exec(r);
      if (mw) {
        cur.minWords = Number(mw[1]);
        r = r.slice(0, mw.index).trim();
      }
      cur.rubric = r;
      cur.stage = "after";
    } else if ((m = RE_MINWORDS.exec(text))) {
      cur.minWords = Number(m[1]);
      cur.stage = "after";
    } else if ((m = RE_TOKEN.exec(text))) {
      cur.tokens.push({ blank: m[2] ? null : Number(m[1]), label: m[3]!.trim() });
      cur.stage = "options";
    } else if (cur.stage !== "after" && (m = RE_OPTION.exec(text)) && !hasImg) {
      cur.options.push({ letter: m[1]!, text: m[2]!.trim() });
      cur.stage = "options";
    } else if (cur.stage !== "after" && (!cur.tag || TAG_TYPES[normTag(cur.tag)] === "matching") && (m = RE_LEFT.exec(text)) && !hasImg) {
      cur.lefts.push({ n: Number(m[1]), text: m[2]!.trim() });
      cur.stage = "options";
    } else if (cur.stage === "prompt") {
      for (const i of b.images) setAlt(i, `Hình minh hoạ câu ${cur.number}`);
      cur.prompt.push(partFrom(b.html, text, b.images));
    } else {
      cur.warnings.push(`Dòng không nhận ra nên bị bỏ qua: “${text.slice(0, 60)}${text.length > 60 ? "…" : ""}”`);
    }
  }
  finish();

  // ---- gắn alt dự phòng cho ảnh
  for (const img of images) {
    if (!img.alt) img.alt = altFallbackFor.get(img.index) ?? "Hình minh hoạ";
  }
  const imgById = new Map(images.map((i) => [i.index, i]));

  // ---- chốt từng câu
  let rows: WordImportRow[] = drafts.map((d) => finalize(d, imgById));
  if (rows.length > WORD_IMPORT_MAX_QUESTIONS) {
    notes.push(`File có ${rows.length} câu; chỉ đọc ${WORD_IMPORT_MAX_QUESTIONS} câu đầu. Hãy chia file thành nhiều lần nhập.`);
    rows = rows.slice(0, WORD_IMPORT_MAX_QUESTIONS);
  }

  // ---- chốt đoạn văn
  const outPassages: WordPassage[] = passages.map((p) => {
    const html = fillAlts(p.parts.join(""), imgById);
    const wp: WordPassage = {
      key: p.key,
      title: p.title,
      html,
      imageIndexes: [...new Set(p.imageIndexes)],
      questionCount: p.questionCount,
    };
    const bad = wp.imageIndexes.map((i) => imgById.get(i)).find((i) => i?.error);
    if (bad) wp.error = `Đoạn văn “${p.title}”: ${bad.error}`;
    else if (!/\S/.test(plainText(html)) && wp.imageIndexes.length === 0) wp.error = `Đoạn văn “${p.title}” chưa có nội dung`;
    if (p.questionCount === 0 && !wp.error) notes.push(`Đoạn văn “${p.title}” chưa có câu hỏi nào (vẫn được tạo).`);
    if (wp.error) notes.push(wp.error);
    return wp;
  });
  const titleByKey = new Map(outPassages.map((p) => [p.key, p.title]));
  rows = rows.map((r) =>
    r.parsed && r.passageKey ? { ...r, parsed: { ...r.parsed, passageTitleRaw: titleByKey.get(r.passageKey) ?? "" } } : r,
  );
  const passageErr = new Map(outPassages.filter((p) => p.error).map((p) => [p.key, p.error!]));
  rows = rows.map((r) => {
    if (r.passageKey && passageErr.has(r.passageKey) && r.status !== "error") {
      return { rowNumber: r.rowNumber, status: "error", errors: [passageErr.get(r.passageKey)!], warnings: [], passageKey: r.passageKey, imageIndexes: r.imageIndexes };
    }
    return r;
  });

  const summary = {
    ok: rows.filter((r) => r.status === "ok").length,
    warning: rows.filter((r) => r.status === "warning").length,
    error: rows.filter((r) => r.status === "error").length,
    total: rows.length,
  };
  return { passages: outPassages, rows, images, summary, notes };
}

function stripLeadingQuestionHead(html: string): string {
  // Cắt "Câu N." + "(x điểm)" + "[nhãn]" ở đầu HTML của dòng (có thể bọc trong <strong>…).
  let s = html.replace(/<\/?(strong|em|u|s)>/gi, "");
  s = s.replace(/^\s*Câu\s+\d+\s*[.:)]\s*/i, "");
  s = s.replace(/^\(\s*[\d.,]+\s*điểm\s*\)\s*/i, "");
  s = s.replace(/^\[(?!\[)[^\[\]]+\]\s*/, "");
  return s;
}

function imgTags(html: string, imgById?: Map<number, WordImage>): string {
  return [...html.matchAll(/<img\b[^>]*>/gi)]
    .map((m) => {
      const idx = /\bsrc="embedded:(\d+)"/i.exec(m[0])?.[1];
      if (idx === undefined) return "";
      const alt = imgById?.has(Number(idx)) ? escapeHtml(imgById.get(Number(idx))!.alt) : (/\balt="([^"]*)"/i.exec(m[0])?.[1] ?? "");
      return `<img src="embedded:${idx}" alt="${alt}">`;
    })
    .join("");
}

/** Điền mô tả ảnh cuối cùng (sau khi đã có alt dự phòng) vào mọi thẻ <img src="embedded:N">. */
function fillAlts(html: string, imgById: Map<number, WordImage>): string {
  return html.replace(/<img src="embedded:(\d+)" alt="[^"]*">/g, (_m, i: string) => `<img src="embedded:${i}" alt="${escapeHtml(imgById.get(Number(i))?.alt ?? "")}">`);
}

// ---------------------------------------------------------------------------------------------------------------------
// 4. Chốt câu → cấu hình
// ---------------------------------------------------------------------------------------------------------------------

const BLANK_RUN = /_{3,}|…{2,}|\.{5,}/g;
const BLANK_TEST = /_{3,}|…{2,}|\.{5,}/;

function parseNumber(s: string): number | null {
  const m = /-?\d+(?:[.,]\d+)?/.exec(s.replace(/\s+/g, ""));
  if (!m) return null;
  const n = Number(m[0].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function inferType(d: Draft, promptText: string): WordQuestionType {
  const ans = (d.answer ?? "").trim();
  if (d.tokens.length > 0 || /\[\[\d+\]\]/.test(promptText)) return "drag_drop_fill";
  if (d.lefts.length > 0) return "matching";
  if (d.rubric !== null || (d.answer === null && d.options.length === 0)) return "essay";
  if (d.options.length > 0) {
    if (/→|->|=>/.test(ans)) return "ordering";
    const letters = ans.toUpperCase().match(/\b[A-Z]\b/g) ?? [];
    return letters.length > 1 ? "multi" : "mcq";
  }
  if (/^(true|false|not\s*given|đúng|sai|không\s*có\s*thông\s*tin)$/i.test(ans)) return "true_false_notgiven";
  if (d.tolerance !== null || /^-?\d+(?:[.,]\d+)?$/.test(ans.replace(/\s+/g, ""))) return "numerical";
  if (BLANK_TEST.test(promptText)) return "gap_fill";
  return "short_answer";
}

function finalize(d: Draft, imgById: Map<number, WordImage>): WordImportRow {
  const errors = [...d.errors];
  const warnings = [...d.warnings];
  const imageIndexes = [...new Set(d.prompt.flatMap((p) => p.images))];
  const fail = (): WordImportRow => ({
    rowNumber: d.number,
    status: "error",
    errors,
    warnings,
    passageKey: d.passageKey,
    imageIndexes,
  });

  // ---- đề bài
  const promptText = d.prompt.map((p) => p.text).filter(Boolean).join("\n\n");
  const richMode = imageIndexes.length > 0 || d.prompt.some((p) => /<(sup|sub)>/i.test(p.html));
  let prompt: string;
  if (richMode) {
    prompt = d.prompt
      .map((p) => {
        const inline = cleanInline(p.html).trim();
        const imgs = imgTags(p.html, imgById);
        return `${inline ? `<p>${inline}</p>` : ""}${imgs ? `<p>${imgs}</p>` : ""}`;
      })
      .join("");
  } else {
    prompt = promptText;
  }
  if (!promptText && imageIndexes.length === 0) errors.push("Thiếu đề bài");
  else if (!promptText) warnings.push("Đề bài chỉ có ảnh, không có chữ");
  if (prompt.length > 5000) errors.push("Đề bài quá dài (>5000 ký tự)");
  const badImg = imageIndexes.map((i) => imgById.get(i)).find((i) => i?.error);
  if (badImg) errors.push(`Câu chứa ${badImg.error}`);

  // ---- điểm
  let points = 1;
  if (d.points) {
    const n = Number(d.points.replace(",", "."));
    if (!Number.isInteger(n) || n < 0 || n > 1000) errors.push(`Điểm phải là số nguyên từ 0 đến 1000, nhận: “${d.points}”`);
    else points = n;
  }

  // ---- dạng
  let type: WordQuestionType | null = null;
  if (d.tag) {
    type = TAG_TYPES[normTag(d.tag)] ?? null;
    if (!type) errors.push(`Nhãn dạng không nhận ra: [${d.tag}]`);
  } else {
    type = inferType(d, promptText);
    warnings.push(`Không có nhãn dạng; đoán là “${TYPE_VI[type]}”`);
  }
  if (!type || errors.length > 0) return fail();

  // ---- cấu hình theo dạng
  let config: Record<string, unknown> | null = null;
  try {
    config = buildConfig(type, d, promptText, warnings);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }
  if (config && d.explanation) config.explanation = d.explanation;
  if (config) {
    const res = configSchemaForType(type).safeParse(config);
    if (!res.success) errors.push(...res.error.issues.map((i) => `${i.path.join(".") || "cấu hình"} ${i.message}`));
    else config = res.data as Record<string, unknown>;
  }
  if (errors.length > 0 || !config) return fail();

  return {
    rowNumber: d.number,
    status: warnings.length > 0 ? "warning" : "ok",
    errors,
    warnings,
    passageKey: d.passageKey,
    imageIndexes,
    parsed: {
      type,
      prompt,
      passageId: null,
      passageTitleRaw: "",
      points,
      difficulty: 2,
      config,
      skillIds: [],
      unresolvedSkillCodes: [],
      notes: null,
    },
  };
}

const TYPE_VI: Record<WordQuestionType, string> = {
  mcq: "Một đáp án",
  multi: "Nhiều đáp án",
  true_false_notgiven: "TRUE / FALSE / NOT GIVEN",
  gap_fill: "Điền khuyết",
  short_answer: "Trả lời ngắn",
  essay: "Tự luận",
  ordering: "Sắp xếp thứ tự",
  matching: "Ghép cặp",
  numerical: "Đáp án dạng số",
  drag_drop_fill: "Kéo thả từ/câu",
};

function lettersOf(s: string): string[] {
  return s.toUpperCase().match(/(?<![A-ZÀ-Ỹ])[A-Z](?![A-ZÀ-Ỹ])/g) ?? [];
}

function buildConfig(type: WordQuestionType, d: Draft, promptText: string, warnings: string[]): Record<string, unknown> {
  const needAnswer = (): string => {
    if (d.answer === null || d.answer.trim() === "") throw new Error("Thiếu dòng “Đáp án:”");
    return d.answer.trim();
  };
  const optionOf = (letter: string) => d.options.find((o) => o.letter === letter);

  switch (type) {
    case "mcq":
    case "multi": {
      if (d.options.length < 2) throw new Error("Cần ít nhất 2 phương án (A., B., …)");
      const ans = needAnswer();
      const correct = [...new Set(lettersOf(ans))];
      const unknown = correct.filter((l) => !optionOf(l));
      if (correct.length === 0) throw new Error(`Không đọc được chữ cái đáp án trong “${ans}”`);
      if (unknown.length > 0) throw new Error(`Đáp án ${unknown.join(", ")} không có trong các phương án`);
      if (type === "mcq" && correct.length !== 1) throw new Error(`Một đáp án cần đúng 1 đáp án đúng, đang có ${correct.length}`);
      return {
        options: d.options.map((o) => ({ id: o.letter.toLowerCase(), label: o.text, isCorrect: correct.includes(o.letter) })),
      };
    }
    case "true_false_notgiven": {
      const ans = needAnswer();
      const norm = (s: string): "true" | "false" | "notgiven" | null => {
        const t = s.trim().toLowerCase().replace(/\s+/g, " ");
        if (t === "true" || t === "đúng") return "true";
        if (t === "false" || t === "sai") return "false";
        if (t === "not given" || t === "notgiven" || t === "ng" || t === "không có thông tin" || t === "không được đề cập") return "notgiven";
        return null;
      };
      let v = norm(ans);
      if (!v) {
        const l = lettersOf(ans);
        const opt = l.length === 1 ? optionOf(l[0]!) : undefined;
        if (opt) v = norm(opt.text);
      }
      if (!v) throw new Error(`Đáp án phải là TRUE, FALSE hoặc NOT GIVEN (hoặc Đúng/Sai), nhận: “${ans}”`);
      return { correct: v };
    }
    case "gap_fill": {
      const ans = needAnswer();
      const blanks = ans
        .split(";")
        .map((part) =>
          part
            .split("|")
            .map((a) => a.trim())
            .filter(Boolean),
        )
        .filter((a) => a.length > 0);
      if (blanks.length === 0) throw new Error("Chưa có đáp án cho chỗ trống");
      const markers = promptText.match(BLANK_RUN)?.length ?? 0;
      if (markers !== blanks.length) {
        warnings.push(`Đề có ${markers} chỗ trống (______) nhưng đáp án có ${blanks.length} mục`);
      }
      return { blanks: blanks.map((a, i) => ({ id: `b${i + 1}`, acceptedAnswers: a, matchMode: "case_insensitive" })) };
    }
    case "short_answer": {
      const ans = needAnswer();
      const accepted = ans.split(";").map((a) => a.trim()).filter(Boolean);
      if (accepted.length === 0) throw new Error("Chưa có đáp án chấp nhận");
      return { acceptedAnswers: accepted, matchMode: "case_insensitive" };
    }
    case "ordering": {
      if (d.options.length < 2) throw new Error("Cần ít nhất 2 mục để sắp xếp (A., B., …)");
      const ans = needAnswer();
      const seq = lettersOf(ans);
      const letters = d.options.map((o) => o.letter);
      if (seq.length !== letters.length || new Set(seq).size !== seq.length || seq.some((l) => !letters.includes(l))) {
        throw new Error(`Thứ tự đúng phải dùng đủ ${letters.length} mục (${letters.join(", ")}), mỗi mục một lần; nhận: “${ans}”`);
      }
      return { items: seq.map((l, i) => ({ id: `o${i + 1}`, label: optionOf(l)!.text })) };
    }
    case "matching": {
      if (d.lefts.length < 2) throw new Error("Cần ít nhất 2 mục ở cột trái (1., 2., …)");
      if (d.options.length !== d.lefts.length) {
        throw new Error(`Cột trái có ${d.lefts.length} mục nhưng cột phải có ${d.options.length} mục; hai cột phải bằng nhau`);
      }
      const ans = needAnswer();
      const pairs = [...ans.matchAll(/(\d+)\s*[-–—=:→>]+\s*([A-Za-z])/g)].map((m) => ({ n: Number(m[1]), l: m[2]!.toUpperCase() }));
      const usedL = new Set<string>();
      const out: Array<{ id: string; left: string; right: string }> = [];
      for (const left of d.lefts) {
        const hit = pairs.find((p) => p.n === left.n);
        if (!hit) throw new Error(`Đáp án thiếu cặp cho mục ${left.n}`);
        const right = optionOf(hit.l);
        if (!right) throw new Error(`Đáp án ghép ${left.n} – ${hit.l}: không có mục ${hit.l} ở cột phải`);
        if (usedL.has(hit.l)) throw new Error(`Mục ${hit.l} ở cột phải được ghép hai lần`);
        usedL.add(hit.l);
        out.push({ id: `m${out.length + 1}`, left: left.text, right: right.text });
      }
      return { pairs: out };
    }
    case "numerical": {
      const ans = needAnswer();
      const expected = parseNumber(ans);
      if (expected === null) throw new Error(`Đáp án phải là một số, nhận: “${ans}”`);
      if (!/^-?\d+(?:[.,]\d+)?\s*\S{0,12}$/.test(ans.trim())) warnings.push("Đáp án có chữ kèm số; chỉ lấy phần số");
      let tolerance = 0;
      if (d.tolerance !== null && d.tolerance.trim() !== "") {
        const t = parseNumber(d.tolerance);
        if (t === null || t < 0) throw new Error(`Sai số phải là số không âm, nhận: “${d.tolerance}”`);
        tolerance = t;
      }
      return { expected, tolerance };
    }
    case "drag_drop_fill": {
      const blanks = [...new Set([...promptText.matchAll(/\[\[(\d+)\]\]/g)].map((m) => Number(m[1])))].sort((a, b) => a - b);
      if (blanks.length === 0) throw new Error("Đề cần có chỗ trống dạng [[1]], [[2]], …");
      if (d.tokens.length === 0) throw new Error("Chưa có thẻ nào (dòng “Thẻ [1]: …”)");
      const tokenBlanks = d.tokens.filter((t) => t.blank !== null).map((t) => t.blank!);
      const missing = blanks.filter((n) => !tokenBlanks.includes(n));
      if (missing.length > 0) throw new Error(`Chỗ trống [[${missing.join("]], [[")}]] chưa có thẻ đúng`);
      const stray = [...new Set(tokenBlanks.filter((n) => !blanks.includes(n)))];
      if (stray.length > 0) throw new Error(`Thẻ [${stray.join("], [")}] không có chỗ trống tương ứng trong đề`);
      return { tokens: d.tokens.map((t, i) => ({ id: `t${i + 1}`, label: t.label, blankIndex: t.blank })) };
    }
    case "essay": {
      const out: Record<string, unknown> = {};
      if (d.rubric) out.rubric = d.rubric;
      if (d.minWords && d.minWords > 0) out.minWords = d.minWords;
      return out;
    }
  }
}

/** Dùng cho bảng xem trước: chuyển HTML đề bài thành chữ ngắn. */
export function wordPromptToText(prompt: string): string {
  return plainText(prompt.replace(/<\/p>/gi, "\n"));
}

export { escapeHtml as _escapeHtmlForTests };
