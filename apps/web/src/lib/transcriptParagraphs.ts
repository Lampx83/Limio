/**
 * LANG đợt 3c — lời thoại của bài nghe chia đoạn để đánh số ①②… (giảng viên có thể viết "đoạn ②" trong ô
 * "Giải thích đáp án"). Chỉ là văn bản thuần: không bao giờ chèn HTML.
 */

/** Tách theo dòng trống; bỏ khoảng trắng thừa và đoạn rỗng. */
export function splitTranscriptParagraphs(text: string): string[] {
  return text
    .split(/\r?\n[ \t]*\r?\n/)
    .map((p) => p.trim())
    .filter((p) => p !== "");
}

const CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";

/** 1 → "①" … 20 → "⑳"; từ 21 trở đi dùng "21." */
export function paragraphMarker(n: number): string {
  return n >= 1 && n <= CIRCLED.length ? CIRCLED[n - 1]! : `${n}.`;
}
