/**
 * Bài HSK do tác giả soạn (khoá "bản gốc Limio", nhập bằng import-course): thân bài là Markdown dựng thành HTML có style nội tuyến nhiều màu,
 * mục lục "Trong bài này", tiêu đề mục `<h2 id="muc-…">` có chip đánh số, hộp `<aside>`… Khác bài nhập từ sách (nhận diện khối theo nội dung 生词/小语讲堂…).
 * Phần này chỉ làm việc thuần chuỗi (chạy được ở máy chủ): nhận ra bài thuộc loại này, tách mỗi khối chữ thành các đoạn theo `<h2 id="muc-…">`,
 * đọc tên mục từ tiêu đề và đánh số mục (đoạn hội thoại B ngay sau A không thêm mục mới mà thành nhãn nhỏ dưới mục Hội thoại).
 * Việc dựng lại HTML (bỏ style, thẻ ngữ pháp, hộp) ở `hskAuthoredDom.ts` (cần DOMParser, chạy ở trình duyệt).
 */

import type { HskSection } from "./hskLesson";

interface ItemLike {
  type: string;
  payload: unknown;
}

const htmlOf = (item: ItemLike): string => {
  const h = (item.payload as { html?: unknown } | null)?.html;
  return typeof h === "string" ? h : "";
};

const NAV_RE = /<nav\b[^>]*aria-label="Mục lục bài học"[\s\S]*?<\/nav>/gi;
const H2_RE = /<h2\b[^>]*\bid="muc-[^"]*"[^>]*>([\s\S]*?)<\/h2>/gi;
// Chỉ nhãn aria của hộp mục tiêu / mục lục / tổng kết là dấu hiệu riêng của bài tác giả: tiêu đề id="muc-…" thì bài nhập từ sách (HSK 3 bản tiếng Việt…) cũng có.
const MARKERS = /aria-label="(?:Mục tiêu bài học|Mục lục bài học|Tổng kết bài học)"/;

/** Khối chữ này do importer của bài tác giả dựng (nhãn aria của hộp mục tiêu, mục lục hoặc tổng kết). */
export function isAuthoredHtml(html: string): boolean {
  return MARKERS.test(html);
}

/** Bài học có ít nhất một khối chữ do tác giả soạn: cả bài dùng cách nhận diện này (không dùng nhận diện theo nội dung của sách). */
export function isAuthoredLesson(items: ItemLike[]): boolean {
  return items.some((it) => it.type === "richtext" && isAuthoredHtml(htmlOf(it)));
}

export type AuthoredKind = "authored" | "a-goals" | "a-summary";

/** Loại khối chữ của bài tác giả: hộp mục tiêu, hộp tổng kết, hay thân bài (có thể chứa nhiều mục). */
export function authoredKind(html: string): AuthoredKind {
  if (/aria-label="Mục tiêu bài học"/.test(html)) return "a-goals";
  if (/aria-label="Tổng kết bài học"/.test(html)) return "a-summary";
  return "authored";
}

export interface AuthoredHeading {
  /** Tên mục bằng chữ Hán ("对话", "语法", "文化"); rỗng nếu tiêu đề không có. */
  zh: string;
  /** Tên mục tiếng Việt ("Hội thoại", "Ngữ pháp"). */
  vi: string;
  /** Chữ cái của khối hội thoại ("A", "B"). */
  tag?: string;
  /** Phần mô tả sau dấu ":" ("xem nhà"). */
  sub?: string;
}

/**
 * Token pinyin của bài tác giả: `{{汉字^pīnyīn}}` (tạo lúc dựng manifest, xem hsk4-goc/author/add_pinyin.py). Importer giữ nguyên dấu `{{ }}` nhưng bọc cụm chữ Hán
 * trong `<span style="font-size:1.3em">`, nên chấp nhận thẻ bọc đó. Dùng `^` (không dùng `|`) vì `|` là dấu ngăn ô của bảng Markdown.
 */
export const PINYIN_TOKEN = /\{\{(?:<span\b[^>]*>)?([㐀-鿿]+)(?:<\/span>)?\^([\p{L}\p{M} ]{1,200}?)\}\}/gu;

/** Bỏ token pinyin, giữ chữ Hán (để đọc chữ thuần của tiêu đề, tìm kiếm…). */
export function stripPinyinTokens(html: string): string {
  return html.replace(PINYIN_TOKEN, "$1");
}

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

/**
 * Tiêu đề mục của importer: chip số + "<chữ Hán> · <tên Việt>" hoặc "<chữ Hán> A · <tên Việt>: <mô tả>" (hội thoại).
 * Bỏ chip số (số mục tự đánh lại cho cả bài); tách chữ Hán, tên Việt, chữ cái khối và mô tả.
 */
export function parseAuthoredHeading(inner: string): AuthoredHeading {
  const noChip = stripPinyinTokens(inner).replace(/<span\b[^>]*>\s*\d+\s*<\/span>/i, "");
  const text = decode(noChip.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  const m = /^(.+?)\s+(?:([A-Z])\s+)?·\s*(.+)$/.exec(text);
  if (!m) return { zh: "", vi: text };
  const zh = m[1]!.replace(/\s+/g, "");
  const tag = m[2];
  const rest = m[3]!.trim();
  if (tag) {
    const k = rest.indexOf(":");
    const vi = (k > 0 ? rest.slice(0, k) : rest).trim();
    const sub = k > 0 ? rest.slice(k + 1).trim() : "";
    return { zh, vi, tag, sub: sub ? sub.charAt(0).toUpperCase() + sub.slice(1) : undefined };
  }
  return { zh, vi: rest };
}

export interface AuthoredPart {
  heading?: AuthoredHeading;
  html: string;
}

/** Tách khối chữ theo các `<h2 id="muc-…">` (bỏ luôn mục lục "Trong bài này"). Phần đứng trước tiêu đề đầu tiên không có heading. */
export function splitAuthoredHtml(html: string): AuthoredPart[] {
  const cleaned = html.replace(NAV_RE, "");
  const parts: AuthoredPart[] = [];
  let last = 0;
  let cur: AuthoredHeading | undefined;
  const push = (end: number) => {
    const chunk = cleaned.slice(last, end);
    if (cur || chunk.trim()) parts.push({ heading: cur, html: chunk });
  };
  for (const m of cleaned.matchAll(H2_RE)) {
    push(m.index!);
    cur = parseAuthoredHeading(m[1]!);
    last = m.index! + m[0].length;
  }
  push(cleaned.length);
  return parts;
}

export interface AuthoredSeg {
  /** Có thì đây là tiêu đề mục đánh số (01, 02…). */
  head?: { no: number; section: HskSection };
  /** Nhãn nhỏ dưới mục ("B" + "Quyết định thuê"): hội thoại tiếp theo của cùng một mục. */
  sub?: { tag?: string; text: string };
  /** Thẻ mềm bao quanh phần nội dung của đoạn (mục Văn hoá). */
  card?: "culture";
  html: string;
}

/**
 * Đánh số mục cho cả bài tác giả: mỗi `<h2 id="muc-…">` là một mục, trừ tiêu đề có cùng tên với mục liền trước (hội thoại A rồi B) chỉ thêm nhãn nhỏ.
 * Trả đoạn của từng khối chữ theo vị trí khối trong bài, và tổng số mục (để đánh số mục "Luyện tập" cuối bài).
 */
export function planAuthored(items: ItemLike[], kinds: string[], startNo = 0): { segs: Map<number, AuthoredSeg[]>; count: number } {
  const segs = new Map<number, AuthoredSeg[]>();
  // `startNo`: phần đặt SAU mục "Luyện tập" (tự đánh giá, tổng kết) đánh số tiếp từ số mục cuối cùng của trang.
  let no = startNo;
  let lastZh = "";
  items.forEach((it, i) => {
    if (kinds[i] !== "authored") return;
    const out: AuthoredSeg[] = [];
    for (const part of splitAuthoredHtml(htmlOf(it))) {
      const h = part.heading;
      const seg: AuthoredSeg = { html: part.html };
      if (h) {
        const key = h.zh || h.vi;
        const sub = h.tag || h.sub ? { tag: h.tag, text: h.sub ?? "" } : undefined;
        if (key === lastZh && h.tag) seg.sub = sub;
        else {
          no += 1;
          seg.head = { no, section: { zh: h.zh, vi: h.vi } };
          if (sub) seg.sub = sub;
          lastZh = key;
        }
        if (h.zh === "文化") seg.card = "culture";
      }
      if (seg.head || seg.sub || seg.html.trim()) out.push(seg);
    }
    segs.set(i, out);
  });
  return { segs, count: no };
}
