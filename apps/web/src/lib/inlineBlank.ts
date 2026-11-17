/**
 * Câu tự luận có MỘT chỗ trống trong đề ("你______，好好休息一下吧。"): học viên gõ thẳng vào chỗ trống thay vì ô soạn thảo riêng bên dưới.
 * Chỉ nhận đề một dòng, văn bản thường (không thẻ HTML) và đúng một chỗ trống (chuỗi gạch dưới liền nhau); còn lại giữ ô soạn thảo như cũ.
 */
const BLANK = /[_＿]{3,}/g;

export function splitSingleBlank(prompt: string): { before: string; after: string } | null {
  if (/[\n\r<>]/.test(prompt)) return null;
  const found = Array.from(prompt.matchAll(BLANK));
  if (found.length !== 1) return null;
  const m = found[0]!;
  return { before: prompt.slice(0, m.index), after: prompt.slice(m.index! + m[0].length) };
}
