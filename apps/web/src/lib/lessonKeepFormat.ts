import { LESSON_MAX_WORDS, type LessonDraftResult, type LessonOutline } from "@feedbackme/shared-types";
import { escapeHtml } from "./lessonRender";

/**
 * Đường "giữ nguyên định dạng" của Tạo bài từ tài liệu (quyết định 2026-10-19):
 * tệp Word hoặc Markdown được đưa thẳng vào MỘT bài, giữ tiêu đề, bảng, ảnh,
 * danh sách như trong tệp — không qua AI, không có bước dàn ý, không thêm bố
 * cục hay hộp mới. Hàm thuần, không đụng DB hay mạng.
 */

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decode(s: string): string {
  return s.replace(/&(#\d+|[a-z]+);/gi, (m, e: string) => (e[0] === "#" ? String.fromCodePoint(Number(e.slice(1))) : ENTITIES[e.toLowerCase()] ?? m));
}

function plain(html: string): string {
  return decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

/** Chữ thường của HTML (đưa cho AI đọc), các khối cách nhau bằng xuống dòng. */
export function plainTextOfHtml(html: string): string {
  return decode(html.replace(/<\/(p|h[1-6]|li|tr|div|blockquote)>/gi, "\n").replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n\s*/g, "\n")
    .trim();
}

/** Số từ của phần chữ trong HTML. */
export function htmlWordCount(html: string): number {
  const t = plain(html);
  return t ? t.split(" ").length : 0;
}

/** Số ảnh trong HTML (chỉ để báo giảng viên). */
export function htmlImageCount(html: string): number {
  return (html.match(/<img\b/gi) ?? []).length;
}

/** Chữ của tiêu đề cấp 1 đầu tiên, nếu tệp mở đầu bằng nó. */
function leadingH1(html: string): { text: string; rest: string } | null {
  const m = /^\s*<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  if (!m) return null;
  return { text: plain(m[1]!), rest: html.slice(m[0].length) };
}

/**
 * Dọn HTML nhập từ tệp: bỏ đoạn trống; bỏ tiêu đề cấp 1 mở đầu nếu nó là tên tài
 * liệu (trang bài học đã có tên bài): tức là liền sau nó là một tiêu đề khác, hoặc
 * nó là tiêu đề cấp 1 duy nhất và bên dưới còn tiêu đề nhỏ hơn. Trả thêm tên
 * tài liệu để làm tên mặc định của bản nháp.
 */
export function cleanImportedHtml(html: string, fallbackTitle: string): { html: string; title: string } {
  let out = html.replace(/<p>(\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, "").trim();
  let title = fallbackTitle;
  const lead = leadingH1(out);
  if (lead && lead.text) {
    title = lead.text.slice(0, 160);
    const rest = lead.rest.trim();
    const followedByHeading = /^<h[1-6]\b/i.test(rest);
    const onlyH1 = !/<h1\b/i.test(rest) && /<h[2-6]\b/i.test(rest);
    if (followedByHeading || onlyH1) out = rest;
  }
  return { html: out, title };
}

// ---------------------------------------------------------------------------
// Markdown → HTML (tập con: tiêu đề, đoạn, danh sách, bảng, trích dẫn, khối mã,
// đường kẻ, **đậm**, *nghiêng*, `mã`, liên kết). Chữ luôn được thoát HTML.
// ---------------------------------------------------------------------------

function safeHref(u: string): string | null {
  const url = u.trim();
  return /^(https?:\/\/|mailto:|\/|#)/i.test(url) ? url : null;
}

function inlineMd(raw: string): string {
  let s = escapeHtml(raw.trim());
  s = s.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  s = s.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (m, label: string, href: string) => {
    const u = safeHref(href.replace(/&amp;/g, "&"));
    return u ? `<a href="${escapeHtml(u)}">${label}</a>` : label;
  });
  s = s.replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*\w])\*([^*\n]+?)\*(?!\*)/g, "$1<em>$2</em>");
  s = s.replace(/(^|[^\w])_([^_\n]+?)_(?!\w)/g, "$1<em>$2</em>");
  return s;
}

const isTableSep = (l: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l) && l.includes("-");
const cells = (l: string) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
const listMatch = (l: string) => /^\s{0,3}([-*+]|\d+[.)])\s+(.*)$/.exec(l);

export function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) {
      i++;
      continue;
    }
    const fence = /^\s*```/.exec(line);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i]!)) body.push(lines[i++]!);
      i++;
      out.push(`<pre><code>${escapeHtml(body.join("\n"))}</code></pre>`);
      continue;
    }
    const h = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (h) {
      out.push(`<h${h[1]!.length}>${inlineMd(h[2]!)}</h${h[1]!.length}>`);
      i++;
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      out.push("<hr>");
      i++;
      continue;
    }
    if (line.includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1]!)) {
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i]!.trim() && lines[i]!.includes("|")) rows.push(cells(lines[i++]!));
      out.push(
        `<table><thead><tr>${head.map((c) => `<th>${inlineMd(c)}</th>`).join("")}</tr></thead><tbody>${rows
          .map((r) => `<tr>${head.map((_, k) => `<td>${inlineMd(r[k] ?? "")}</td>`).join("")}</tr>`)
          .join("")}</tbody></table>`,
      );
      continue;
    }
    if (/^\s*>/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i]!)) body.push(lines[i++]!.replace(/^\s*>\s?/, ""));
      out.push(`<blockquote><p>${inlineMd(body.join(" "))}</p></blockquote>`);
      continue;
    }
    const li = listMatch(line);
    if (li) {
      const ordered = /\d/.test(li[1]!);
      const items: string[] = [];
      while (i < lines.length) {
        const m = listMatch(lines[i]!);
        if (m && /\d/.test(m[1]!) === ordered) {
          items.push(m[2]!);
          i++;
        } else if (lines[i]!.trim() && /^\s{2,}\S/.test(lines[i]!) && items.length) {
          items[items.length - 1] += ` ${lines[i]!.trim()}`;
          i++;
        } else break;
      }
      const tag = ordered ? "ol" : "ul";
      out.push(`<${tag}>${items.map((t) => `<li><p>${inlineMd(t)}</p></li>`).join("")}</${tag}>`);
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() &&
      !/^(#{1,6}\s|\s*```|\s*>)/.test(lines[i]!) &&
      !listMatch(lines[i]!) &&
      !(lines[i]!.includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1]!))
    ) {
      para.push(lines[i++]!.trim());
    }
    out.push(`<p>${inlineMd(para.join(" "))}</p>`);
  }
  return out.join("");
}

// ---------------------------------------------------------------------------

export interface KeepFormatDraftParts {
  outline: LessonOutline;
  result: LessonDraftResult;
  words: number;
}

/**
 * Dựng phần dữ liệu của bản nháp "giữ nguyên định dạng": dàn ý một bài một mục
 * (chỉ để lấp hình dạng dữ liệu, giao diện không hiển thị) và bài đã sẵn có.
 */
export function keepFormatDraftParts(html: string, title: string, now = new Date()): KeepFormatDraftParts {
  return {
    words: htmlWordCount(html),
    outline: {
      lessons: [
        {
          id: "l1",
          title,
          objectives: [],
          sections: [{ id: "s1", title, layout: "text", points: [], boxes: [], paras: [] }],
        },
      ],
      ignoredParas: [],
      template: "theory",
      keepFormat: true,
    },
    result: { lessons: [{ title, html }], fallbackSections: [], missingParas: [], writing: "keep", generatedAt: now.toISOString() },
  };
}

export { LESSON_MAX_WORDS };
