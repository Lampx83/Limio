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
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, "<br>")}</p>`)
    .join("");
}
