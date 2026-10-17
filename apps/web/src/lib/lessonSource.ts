import type { SourcePara } from "@feedbackme/shared-types";

/**
 * Tách tài liệu gốc thành các ĐOẠN đánh số — đơn vị mà dàn ý trỏ về ("mục này
 * lấy từ đoạn 3–7"), và là thứ giảng viên nhìn thấy ở thẻ "Tài liệu gốc".
 * Hàm thuần, không gọi mạng, không đụng DOM (chạy được ở server và trong test).
 */

/** Trần để một tài liệu khổng lồ không làm phình bản nháp và lời nhắc AI. */
export const SOURCE_MAX_PARAS = 600;
export const SOURCE_MAX_CHARS = 120_000;
/** Một đoạn quá dài (PDF không xuống dòng) bị cắt ở ranh giới câu gần nhất. */
const PARA_MAX_CHARS = 2_000;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

function clean(s: string): string {
  return s.replace(/[ \s]+/g, " ").trim();
}

/** Cắt đoạn quá dài thành nhiều đoạn, ưu tiên cắt sau dấu kết câu. */
function splitLong(t: string): string[] {
  if (t.length <= PARA_MAX_CHARS) return [t];
  const out: string[] = [];
  let rest = t;
  while (rest.length > PARA_MAX_CHARS) {
    const window = rest.slice(0, PARA_MAX_CHARS);
    const cut = Math.max(window.lastIndexOf(". "), window.lastIndexOf("? "), window.lastIndexOf("! "));
    const at = cut > PARA_MAX_CHARS * 0.4 ? cut + 1 : PARA_MAX_CHARS;
    out.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) out.push(rest);
  return out;
}

function finish(paras: SourcePara[]): SourcePara[] {
  const out: SourcePara[] = [];
  let chars = 0;
  for (const p of paras) {
    if (out.length >= SOURCE_MAX_PARAS || chars >= SOURCE_MAX_CHARS) break;
    if ("t" in p) {
      for (const piece of splitLong(p.t)) {
        if (out.length >= SOURCE_MAX_PARAS || chars >= SOURCE_MAX_CHARS) break;
        out.push({ t: piece });
        chars += piece.length;
      }
    } else {
      out.push(p);
    }
  }
  return out;
}

/** Dòng ngắn viết hoa toàn bộ — tiêu đề trong PDF. */
function isCapsHeading(line: string): boolean {
  return line.length <= 60 && line === line.toUpperCase() && /\p{L}/u.test(line);
}

/** Dòng trông như tiêu đề hoặc gạch đầu dòng — không được nối vào dòng trước. */
function startsBlock(line: string): boolean {
  return /^([-•*–]\s|\d+[.)]\s|[IVX]+\.\s|[a-zđ]\)\s)/i.test(line) || isCapsHeading(line);
}

/**
 * Văn bản thuần (.txt, .md, văn bản dán, chữ rút từ PDF/Word).
 * `reflow`: PDF ngắt dòng theo bề ngang trang chứ không theo đoạn — nối các dòng
 * bị ngắt giữa câu lại thành đoạn. Văn bản dán và .txt giữ nguyên từng dòng.
 */
export function textToParas(text: string, opts: { reflow?: boolean } = {}): SourcePara[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const paras: string[] = [];
  let cur = "";
  for (const raw of lines) {
    // Bỏ dấu Markdown đầu dòng cho dễ đọc, giữ chữ.
    const line = clean(raw.replace(/^#{1,6}\s+/, "").replace(/^>\s?/, ""));
    if (!line) {
      if (cur) paras.push(cur);
      cur = "";
      continue;
    }
    // Số trang đứng một mình (PDF) — không phải nội dung.
    if (opts.reflow && /^\d{1,4}$/.test(line)) continue;
    if (opts.reflow && cur && !/[.!?:;…"”)\]]$/.test(cur) && !isCapsHeading(cur) && !startsBlock(line)) {
      // Từ bị gạch nối cuối dòng thì nối liền, còn lại nối bằng dấu cách.
      cur = cur.endsWith("-") ? cur.slice(0, -1) + line : `${cur} ${line}`;
      continue;
    }
    if (cur) paras.push(cur);
    cur = line;
    if (!opts.reflow) {
      paras.push(cur);
      cur = "";
    }
  }
  if (cur) paras.push(cur);
  return finish(paras.map((t) => ({ t })));
}

/**
 * HTML do mammoth sinh từ .docx: mỗi khối (đoạn, tiêu đề, mục danh sách, hàng
 * bảng, trích dẫn) thành một đoạn; mỗi ảnh thành một đoạn riêng giữ đúng vị trí.
 */
export function htmlToParas(html: string): SourcePara[] {
  const images: Array<{ img: string; alt: string }> = [];
  let s = html.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = /\bsrc\s*=\s*"([^"]*)"/i.exec(tag)?.[1] ?? "";
    if (!src) return " ";
    const alt = decodeEntities(/\balt\s*=\s*"([^"]*)"/i.exec(tag)?.[1] ?? "");
    images.push({ img: src, alt: clean(alt) });
    return `\n\u0000${images.length - 1}\u0000\n`;
  });
  // Ô bảng: mammoth bọc chữ trong ô bằng <p> — gỡ đi để cả hàng thành một đoạn "ô | ô | ô".
  s = s.replace(/<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _tag, inner: string) =>
    `${inner.replace(/<\/p>\s*<p\b[^>]*>/gi, " ").replace(/<\/?p\b[^>]*>/gi, "")} | `,
  );
  s = s
    .replace(/<(br)\s*\/?>/gi, "\n")
    .replace(/<\/(p|h[1-6]|li|tr|blockquote|div|table|ul|ol)>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  s = decodeEntities(s);

  const paras: SourcePara[] = [];
  for (const raw of s.split("\n")) {
    const parts = raw.split(/\u0000(\d+)\u0000/);
    parts.forEach((part, i) => {
      if (i % 2 === 1) {
        const img = images[Number(part)];
        if (img) paras.push(img);
        return;
      }
      const t = clean(part).replace(/(\s*\|\s*)+$/, "").replace(/^(\|\s*)+/, "");
      if (t) paras.push({ t });
    });
  }
  return finish(paras);
}

/** Số chữ (từ) của phần chữ — để ước lượng thời gian đọc. */
export function wordCount(paras: SourcePara[]): number {
  return paras.reduce((n, p) => n + ("t" in p ? p.t.split(/\s+/).filter(Boolean).length : 0), 0);
}
