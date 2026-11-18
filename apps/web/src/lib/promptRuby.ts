import { alignReading, pinyinSyllables } from "./rolePlayView";

const HAN_G = /[㐀-鿿]/g;
/** Từ chữ Latin (chữ Việt/Anh, pinyin gợi ý) trong đề lẫn: không có trong `promptAid.reading` của câu chữ Hán nên bỏ ra khi đếm và ghép; chữ Hán vẫn là thước đo. */
const LATIN_WORD = /[A-Za-z\u00c0-\u1ef9][A-Za-z\u00c0-\u1ef9'’\u0300-\u036f-]*/g;

/**
 * Pinyin dưới từng chữ Hán của đề câu hỏi luyện tập: ghép `promptAid.reading` với đề. Chỉ nhận đề một dòng, văn bản thường (không thẻ HTML);
 * đề không có chữ Hán, hoặc pinyin không khớp số chữ Hán, thì null (đề hiện như cũ kèm dòng pinyin nhỏ bên dưới). Chỗ trống "____" trong đề không tính.
 */
export function promptSyllables(text: string, reading: string | undefined): string[] | null {
  if (!reading || /[\n\r<>]/.test(text) || !/[㐀-鿿]/.test(text)) return null;
  // Đề lẫn lời dẫn tiếng Việt hoặc gợi ý, vd "Điền một từ còn thiếu: 发视频…(yǔnxǔ)", "…太____了。(nặng)": chỉ ghép phần chữ Hán (chữ Hán trong gợi ý làm lệch số chữ → không ghép, giữ dòng pinyin cũ).
  const core = text.replace(LATIN_WORD, "");
  return alignReading(core, reading);
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

/** Đề hỏi chính cách đọc / pinyin / thanh điệu: pinyin dưới chữ Hán sẽ lộ đáp án. */
const ASKS_READING = /pinyin|phi[êe]n\s*[âa]m|c[áa]ch\s*đọc|thanh\s*điệu|đọc\s*(?:đúng|là|như)/i;
const TONE_MARK = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/;
/** Chữ chỉ có trong tiếng Việt: nhãn có chữ này không phải pinyin. */
const VI_ONLY = /[đăâêôơưạảãẹẻẽịỉĩọỏõụủũỳỷỹỵýấầẩẫậắằẳẵặếềểễệốồổỗộớờởỡợứừửữự]/i;

function labelsOf(config: unknown): string[] {
  const c = config && typeof config === "object" ? (config as Record<string, unknown>) : {};
  const out: string[] = [];
  for (const key of ["options", "tokens", "items", "lefts", "rights"]) {
    const v = c[key];
    if (!Array.isArray(v)) continue;
    for (const x of v) {
      const l = x && typeof x === "object" ? (x as { label?: unknown }).label : null;
      if (typeof l === "string") out.push(l);
    }
  }
  return out;
}

function looksLikePinyin(label: string): boolean {
  const t = label.trim();
  if (!t || VI_ONLY.test(t) || /[^\p{L}\s'’-]/u.test(t) || /[\u3400-\u9fff]/.test(t)) return false;
  return t.split(/[\s'’-]+/).filter(Boolean).every((w) => pinyinSyllables(w) !== null);
}

/**
 * Câu hỏi mà pinyin dưới chữ Hán làm lộ đáp án (hoặc phá bài kiểm): cờ tuỳ chọn `config.hidePinyin === true`; đề nói tới pinyin/phiên âm/cách đọc/thanh điệu;
 * hoặc các phương án đều là pinyin (bài chọn cách đọc của chữ Hán trong đề). Khi đó không dựng ruby ở đề, phương án, ngân hàng từ và cũng không hiện dòng pinyin của đề.
 */
export function questionHidesPinyin(prompt: string, config: unknown): boolean {
  if (config && typeof config === "object" && (config as Record<string, unknown>).hidePinyin === true) return true;
  if (ASKS_READING.test(prompt)) return true;
  const labels = labelsOf(config);
  return labels.length >= 2 && labels.every(looksLikePinyin) && labels.some((l) => TONE_MARK.test(l));
}
