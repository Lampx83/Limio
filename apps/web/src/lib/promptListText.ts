import { looksLikeHtml } from "@/lib/richText";

/**
 * Đề bài của câu hỏi dùng trong danh sách (trình soạn đề thi): đề thường là chữ thường; đề nhập từ Word có ảnh được lưu dạng HTML
 * (`<p>…</p><p><img …></p>`) nên danh sách phải rút lại thành chữ, kèm số ảnh, thay vì in thẻ ra màn hình.
 */
export function promptListText(prompt: string): { text: string; images: number } {
  if (!prompt || !looksLikeHtml(prompt)) return { text: prompt ?? "", images: 0 };
  const images = (prompt.match(/<img\b/gi) ?? []).length;
  const text = prompt
    .replace(/<\/(p|h[1-6]|li|div)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
  return { text, images };
}
