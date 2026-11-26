/**
 * Tách HTML bài viết (richtext) thành các đoạn nhỏ để mỗi đoạn là một màn chiếu lớp (docs/tieu-chi/hsk-che-do-chieu-lop.md, A1–A7).
 * Hàm thuần, chạy được ở máy chủ lẫn trình duyệt, không cần DOMParser.
 */

const VOID = new Set(["br", "hr", "img", "input", "meta", "link", "wbr", "source", "col", "area", "base", "embed", "track"]);

const TAG = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;

/** Các khối cấp cao nhất của HTML (phần tử gốc nguyên vẹn; chữ trần ở cấp gốc được bọc `<p>`). */
export function topLevelBlocks(html: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = -1;
  let last = 0;
  TAG.lastIndex = 0;
  const pushText = (from: number, to: number) => {
    const t = html.slice(from, to);
    if (t.replace(/&nbsp;|\s/g, "")) out.push(`<p>${t.trim()}</p>`);
  };
  for (let m = TAG.exec(html); m; m = TAG.exec(html)) {
    if (m[0].startsWith("<!--")) continue;
    const closing = m[1] === "/";
    const name = m[2]!.toLowerCase();
    const selfClosed = m[0].endsWith("/>") || VOID.has(name);
    if (depth === 0 && !closing) {
      pushText(last, m.index);
      start = m.index;
      if (selfClosed) {
        out.push(m[0]);
        start = -1;
        last = TAG.lastIndex;
        continue;
      }
      depth = 1;
    } else if (!selfClosed) {
      depth += closing ? -1 : 1;
      if (depth === 0 && start >= 0) {
        out.push(html.slice(start, TAG.lastIndex));
        start = -1;
        last = TAG.lastIndex;
      }
    }
  }
  if (depth === 0) pushText(last, html.length);
  return out;
}

const ENT: Record<string, string> = { "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };

/** Chữ thuần của HTML; dấu `{{字^pinyin}}` còn lại đúng chữ Hán. */
export function plainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (m) => ENT[m] ?? m)
    .replace(/\{\{([^^{}]*)\^[^{}]*\}\}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function headingLevel(block: string): number {
  const m = /^<h([1-6])\b/i.exec(block);
  return m ? Number(m[1]) : 0;
}

function ariaLabel(block: string): string {
  const m = /^<[a-z]+\b[^>]*\baria-label="([^"]*)"/i.exec(block);
  return m ? m[1]! : "";
}

/**
 * Danh sách dài (`<ol>`/`<ul>` có từ 4 mục, vượt `maxChars`) tách thành các danh sách con ≤ `maxChars` chữ, giữ nguyên thẻ, thuộc tính và số thứ tự
 * (`start`) để màn không phải co chữ quá nhỏ. Khối khác trả về nguyên.
 */
function splitLongList(block: string, maxChars: number): string[] {
  const m = /^<(ol|ul)\b([^>]*)>([\s\S]*)<\/\1>$/i.exec(block);
  if (!m || plainText(block).length <= maxChars) return [block];
  const tag = m[1]!.toLowerCase();
  const attrs = m[2]!;
  const items = topLevelBlocks(m[3]!).filter((x) => /^<li\b/i.test(x));
  if (items.length < 4) return [block];
  const startAttr = /\bstart="(\d+)"/i.exec(attrs);
  const base = startAttr ? Number(startAttr[1]) : 1;
  const groups: string[][] = [[]];
  let chars = 0;
  for (const it of items) {
    const n = plainText(it).length;
    if (chars + n > maxChars && groups[groups.length - 1]!.length) {
      groups.push([]);
      chars = 0;
    }
    groups[groups.length - 1]!.push(it);
    chars += n;
  }
  if (groups.length < 2) return [block];
  let no = base;
  return groups.map((g) => {
    const a = tag === "ol" ? `${attrs.replace(/\sstart="\d+"/i, "")} start="${no}"` : attrs;
    no += g.length;
    return `<${tag}${a}>${g.join("")}</${tag}>`;
  });
}

export interface HtmlChunk {
  /** Tên mục (h2 gần nhất, hoặc nhãn của khối như "Mục tiêu bài học"); rỗng nếu chưa có. */
  label: string;
  /** Tiêu đề của chính đoạn (h3 hoặc h2 mở đoạn); rỗng với đoạn nối tiếp. */
  title: string;
  html: string;
  /** Đoạn nối tiếp của một mục đã dài, không có tiêu đề riêng. */
  cont: boolean;
}

/**
 * Cắt tại mỗi h2/h3 và khi đoạn vượt `maxChars` chữ. Bỏ mục lục (`<nav>`) và khối rỗng chữ, rỗng ảnh.
 * h2 đứng ngay trước h3 thì dính vào đoạn của h3 để không có màn chỉ có tiêu đề.
 */
export function chunkRichText(html: string, maxChars = 380): HtmlChunk[] {
  const blocks = topLevelBlocks(html)
    .filter((b) => !/^<nav\b/i.test(b))
    .flatMap((b) => splitLongList(b, maxChars));
  const chunks: HtmlChunk[] = [];
  let label = "";
  let cur: { parts: string[]; title: string; body: boolean; chars: number; cont: boolean } | null = null;
  const flush = () => {
    if (cur && cur.parts.length) chunks.push({ label, title: cur.title, html: cur.parts.join(""), cont: cur.cont });
    cur = null;
  };
  for (const b of blocks) {
    const lvl = headingLevel(b);
    const text = plainText(b);
    if (!lvl && !text && !/<img\b/i.test(b)) continue;
    if (lvl === 2) {
      if (cur && cur.body) flush(); // h2 liền h2/h3 (chưa có thân): giữ cùng một đoạn
      label = text;
    } else if (lvl === 3 && cur && cur.body) {
      flush();
    }
    if (!cur) cur = { parts: [], title: "", body: false, chars: 0, cont: false };
    const section = ariaLabel(b);
    if (section && !label) label = section;
    if (!lvl && cur.body && cur.chars + text.length > maxChars) {
      flush();
      cur = { parts: [], title: "", body: false, chars: 0, cont: true };
    }
    cur.parts.push(b);
    if (lvl) {
      if (!cur.title || lvl === 3) cur.title = text;
    } else {
      cur.body = true;
      cur.chars += text.length;
    }
  }
  flush();
  return chunks;
}

/**
 * Cỡ chữ nội tuyến của bài tác giả tính bằng rem (thân bài 1,25rem, tiêu đề mục 1,7rem…). Đổi `font-size: Xrem` thành em với thân bài = 1em để màn chiếu
 * giữ đúng tỉ lệ các cấp chữ của bài học mà vẫn co giãn theo cỡ chữ người dạy chọn. Các giá trị khác (lề, đệm) giữ nguyên.
 */
export function scaleInlineFontSizes(html: string, base = 1.25): string {
  return html.replace(/\bstyle="([^"]*)"/g, (_m, css: string) => {
    const next = css.replace(/(font-size\s*:\s*)(-?\d*\.?\d+)rem\b/g, (_x, pre: string, n: string) => `${pre}${+(parseFloat(n) / base).toFixed(3)}em`);
    return `style="${next}"`;
  });
}

/**
 * Chữ in đậm dài (cả câu, vd. câu tóm tắt tiếng Trung của tình huống) không phải "từ quan trọng": đổi thẻ <strong> thành đoạn đậm thường để không bị tô nổi bật.
 * Chỉ cụm ngắn (≤ `max` chữ, không tính pinyin) giữ <strong> và được tô màu.
 */
export function demoteLongStrong(html: string, max = 14): string {
  return html.replace(/<strong>([\s\S]*?)<\/strong>/g, (m, inner: string) => (plainText(inner).length > max ? `<span class="teach-strong-long" style="font-weight:700">${inner}</span>` : m));
}
