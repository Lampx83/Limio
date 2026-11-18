/**
 * Pinyin tự tính cho chữ Hán của Bài luyện khoá tiếng Trung, ở chỗ dữ liệu câu hỏi KHÔNG có pinyin tác giả viết (phương án, ngân hàng từ, ô đã chọn…).
 * Bảng sinh sẵn từ pypinyin (`scripts/gen-han-pinyin.py`): âm mặc định của từng chữ + bảng từ 2-3 chữ đọc khác âm mặc định (chữ đa âm: 银行, 觉得, 着急…).
 * Đổi thanh của 一 / 不 làm bằng luật. Không đoán được (chữ ngoài bảng, ví dụ phồn thể hiếm) thì trả "" cho chữ đó: người gọi hiện chữ trơn.
 * Pinyin do tác giả viết trong `promptAid.reading` luôn được ưu tiên hơn (xem `promptRuby.ts`); module này chỉ là phương án dự phòng.
 */
import { HAN_CHARS, HAN_WORDS } from "./hanPinyinData";

const HAN = /[㐀-鿿]/;
const KANA_HANGUL = /[぀-ヿ가-힯]/;

let chars: Map<string, string> | null = null;
let words: Map<string, string[]> | null = null;

function load() {
  if (chars && words) return;
  chars = new Map(HAN_CHARS.split(";").map((e) => [e.slice(0, 1), e.slice(2)] as [string, string]));
  words = new Map(HAN_WORDS.split(";").map((e) => {
    const i = e.indexOf(":");
    return [e.slice(0, i), e.slice(i + 1).split(" ")] as [string, string[]];
  }));
}

/** Thanh của một âm tiết có dấu (1-4; 0 = thanh nhẹ / không dấu). */
export function toneOf(syllable: string): number {
  for (const ch of syllable.normalize("NFD")) {
    const c = ch.codePointAt(0)!;
    if (c === 0x304) return 1;
    if (c === 0x301) return 2;
    if (c === 0x30c) return 3;
    if (c === 0x300) return 4;
  }
  return 0;
}

const DIGITISH = "一二三四五六七八九十零百千万两";

/** 一 và 不 đổi thanh theo âm tiết đứng sau (một + thanh 4 → yí, một + thanh 1/2/3 → yì; 不 + thanh 4 → bú). */
function applySandhi(text: string, out: string[]): void {
  const han = [...text].filter((c) => HAN.test(c));
  for (let i = 0; i < han.length - 1; i++) {
    const c = han[i]!;
    const next = out[i + 1] ?? "";
    if (!next) continue;
    const t = toneOf(next);
    if (c === "不" && t === 4) out[i] = "bú";
    else if (c === "一" && !DIGITISH.includes(han[i + 1]!)) out[i] = t === 4 ? "yí" : t >= 1 ? "yì" : out[i]!;
  }
}

/**
 * Âm tiết cho TỪNG chữ Hán của `text` theo thứ tự (không tính ký tự khác). Chữ không có trong bảng nhận "".
 * Trả null khi `text` không có chữ Hán hoặc có kana/Hangul (không phải tiếng Trung).
 */
export function hanSyllables(text: string): string[] | null {
  if (!HAN.test(text) || KANA_HANGUL.test(text)) return null;
  load();
  const out: string[] = [];
  // Duyệt từng đoạn chữ Hán liền nhau: ghép từ dài nhất (3 rồi 2 chữ) trước, không có thì âm mặc định của chữ.
  for (const run of text.match(/[㐀-鿿]+/g) ?? []) {
    const start = out.length;
    const cs = [...run];
    for (let i = 0; i < cs.length; ) {
      let took = 0;
      for (const n of [3, 2]) {
        if (i + n > cs.length) continue;
        const w = words!.get(cs.slice(i, i + n).join(""));
        if (w) {
          out.push(...w);
          took = n;
          break;
        }
      }
      if (!took) {
        out.push(chars!.get(cs[i]!) ?? "");
        took = 1;
      }
      i += took;
    }
    // Luật 一 / 不 trong đoạn vừa thêm.
    const seg = out.slice(start);
    applySandhi(run, seg);
    out.splice(start, seg.length, ...seg);
  }
  return out;
}
