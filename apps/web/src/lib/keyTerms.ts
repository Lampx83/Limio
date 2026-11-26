/**
 * Từ quan trọng trên màn chiếu (từ mới của bài): tìm trong câu chữ Hán để tô nổi bật.
 * Hàm thuần: không đọc DB.
 */

const HAN = /[㐀-鿿]/;

/** Từ khoá để tô trong hội thoại: từ mới của bài có từ 2 chữ Hán trở lên (từ một chữ như 定, 空 trùng quá nhiều chỗ nên bỏ), dài trước ngắn. */
export function keyTermsFromVocab(terms: string[]): string[] {
  const seen = new Set<string>();
  for (const raw of terms) {
    const t = raw.trim();
    if ([...t].filter((c) => HAN.test(c)).length >= 2) seen.add(t);
  }
  return [...seen].sort((a, b) => b.length - a.length);
}

/**
 * Cắt câu thành các đơn vị cho `RubyText`: mỗi chữ Hán một đơn vị (`scored`), mỗi đoạn không phải chữ Hán một đơn vị; `hl` = chữ thuộc một từ khoá.
 * Từ khoá dài được ưu tiên; hai lần xuất hiện không chồng nhau.
 */
export function splitHanWords(text: string, keys: string[]): Array<{ text: string; scored: boolean; hl: boolean }> {
  const chars = [...text];
  const flag = new Array<boolean>(chars.length).fill(false);
  for (const k of [...keys].sort((a, b) => b.length - a.length)) {
    if (!k) continue;
    const kc = [...k];
    for (let i = 0; i + kc.length <= chars.length; i++) {
      if (chars.slice(i, i + kc.length).join("") === k && !flag.slice(i, i + kc.length).some(Boolean)) {
        for (let j = i; j < i + kc.length; j++) flag[j] = true;
        i += kc.length - 1;
      }
    }
  }
  const out: Array<{ text: string; scored: boolean; hl: boolean }> = [];
  chars.forEach((c, i) => {
    if (HAN.test(c)) out.push({ text: c, scored: true, hl: flag[i]! });
    else if (out.length && !out[out.length - 1]!.scored && out[out.length - 1]!.hl === flag[i]) out[out.length - 1]!.text += c;
    else out.push({ text: c, scored: false, hl: flag[i]! });
  });
  return out;
}
