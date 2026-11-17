import { alignReading } from "./rolePlayView";

const HAN_G = /[㐀-鿿]/g;

/**
 * Pinyin dưới từng chữ Hán của đề câu hỏi luyện tập: ghép `promptAid.reading` với đề. Chỉ nhận đề một dòng, văn bản thường (không thẻ HTML);
 * đề không có chữ Hán, hoặc pinyin không khớp số chữ Hán, thì null (đề hiện như cũ kèm dòng pinyin nhỏ bên dưới). Chỗ trống "____" trong đề không tính.
 */
export function promptSyllables(text: string, reading: string | undefined): string[] | null {
  if (!reading || /[\n\r<>]/.test(text) || !/[㐀-鿿]/.test(text)) return null;
  return alignReading(text, reading);
}

/** Chia dãy âm tiết của cả đề cho từng đoạn chữ (đề bị chèn ô gõ ở giữa): mỗi đoạn nhận đúng số âm tiết bằng số chữ Hán của nó. */
export function sliceByHan(syllables: string[], parts: string[]): string[][] {
  let i = 0;
  return parts.map((p) => {
    const n = (p.match(HAN_G) ?? []).length;
    const out = syllables.slice(i, i + n);
    i += n;
    return out;
  });
}
