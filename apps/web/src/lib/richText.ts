/**
 * Utilities for the gradual migration from plain `<textarea>` text fields
 * (stored as raw strings) to Tiptap-authored HTML.
 *
 * Legacy values in the DB are plain text with `\n` line breaks. New values
 * are HTML strings produced by Tiptap. Both must round-trip through the
 * RichTextEditor and the SafeHtml renderer without surprises.
 */

const HTML_TAG_RE = /<[a-z][\s\S]*?>/i;

/** True when the string already contains HTML markup. */
export function looksLikeHtml(value: string): boolean {
  return HTML_TAG_RE.test(value);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Convert a legacy plain-text value into a minimal HTML representation that
 * Tiptap can parse — double newlines become paragraph breaks, single newlines
 * become `<br>`. HTML inputs are returned unchanged.
 */
export function plainToRichHtml(value: string | null | undefined): string {
  if (!value) return "";
  if (looksLikeHtml(value)) return value;
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed
    .split(/\n\s*\n/)
    .map((para) => `<p>${withMath(para, (t) => escapeHtml(t).replace(/\n/g, "<br>"))}</p>`)
    .join("");
}

/**
 * Công thức trong chữ thường: `$x^2-5x+6=0$` → span data-latex (SafeHtml dựng bằng KaTeX, xem lib/mathRender.ts). Cùng
 * luật với importer: sau "$" mở và trước "$" đóng không có khoảng trắng, sau "$" đóng không là chữ số — nên "giá $5 và
 * $10" vẫn là tiền. Đề thi / phương án / giải thích của câu hỏi đều đi qua plainToRichHtml, nên một chỗ này phủ hết.
 */
const MATH_IN_TEXT = /\$([^\s$](?:[^$\n]*?[^\s$])?)\$(?!\d)/g;

function withMath(text: string, escapeRest: (t: string) => string): string {
  let out = "";
  let last = 0;
  for (const m of text.matchAll(MATH_IN_TEXT)) {
    out += escapeRest(text.slice(last, m.index));
    const latex = escapeHtml(m[1]!);
    out += `<span class="math-inline" data-latex="${latex}">${latex}</span>`;
    last = m.index! + m[0].length;
  }
  return out + escapeRest(text.slice(last));
}

/**
 * Strip HTML markup from a (possibly Tiptap-authored) string to produce a
 * plain-text preview suitable for `line-clamp`/meta UI (catalog cards, list
 * snippets, search results). Plain-text inputs are returned unchanged.
 *
 * Not a sanitizer — never feed the output back into `dangerouslySetInnerHTML`.
 * For rendering rich content, use `<SafeHtml>` instead.
 */
export function htmlToPlainText(value: string | null | undefined): string {
  if (!value) return "";
  if (!looksLikeHtml(value)) return value;
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/(p|div|li|h[1-6]|tr|br)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
