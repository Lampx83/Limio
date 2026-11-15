/**
 * Thêm pinyin vào chữ của các lượt hội thoại đóng vai: `你好吗？` → `你好吗？ Nǐ hǎo ma?` (cùng khuôn giáo viên đã tự ghi tay).
 * Phần thuần để kiểm thử; ghi DB nằm ở `fill-roleplay-pinyin.ts`. Chấm điểm và đọc audio đều bỏ phần pinyin cuối câu (xem `compareSpoken`, `roleplaySpeakable`).
 */

const HAN_OR_FULLWIDTH = /[㐀-鿿　-〿＀-￯]/;
const HAN = /[㐀-鿿]/;
const TONE_MARK = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/i;

/** Phần chữ Hán của lượt (đến chữ Hán/dấu câu toàn chiều rộng cuối cùng) và phần đuôi viết sau đó (đã bỏ khoảng trắng đầu/cuối). */
export function splitTail(text: string): { han: string; tail: string } {
  let last = -1;
  for (let i = text.length - 1; i >= 0; i--) {
    if (HAN_OR_FULLWIDTH.test(text[i]!)) {
      last = i;
      break;
    }
  }
  return { han: text.slice(0, last + 1), tail: text.slice(last + 1).trim() };
}

/** Lượt đã có pinyin sau chữ Hán (có dấu thanh, hoặc từ hai từ Latin trở lên). Một từ Latin cuối câu (vd "App") không tính. */
export function hasTrailingPinyin(text: string): boolean {
  if (!HAN.test(text)) return false;
  const { tail } = splitTail(text);
  return tail !== "" && (TONE_MARK.test(tail) || tail.split(/\s+/).length >= 2);
}

export interface PinyinFill {
  config: unknown;
  added: number;
  /** Lượt có chữ Hán nhưng không có trong bảng pinyin (không đoán). */
  missing: string[];
  /** Lượt đã có pinyin (giáo viên tự ghi) nên giữ nguyên. */
  kept: number;
}

/** Thêm pinyin cho các lượt chưa có. `map` = {câu tiếng Trung: pinyin}; không sửa cấu hình cũ, không đụng lượt đã có pinyin. */
export function fillRoleplayPinyin(config: unknown, map: Record<string, string>): PinyinFill {
  const rp = (config as { roleplay?: { turns?: Array<{ text: string }> } } | null)?.roleplay;
  if (!rp || !Array.isArray(rp.turns)) return { config, added: 0, missing: [], kept: 0 };
  let added = 0;
  let kept = 0;
  const missing: string[] = [];
  const turns = rp.turns.map((t) => {
    if (typeof t.text !== "string" || !HAN.test(t.text)) return t;
    if (hasTrailingPinyin(t.text)) {
      kept += 1;
      return t;
    }
    const { han } = splitTail(t.text);
    const py = map[han.trim()] ?? map[t.text.trim()];
    if (!py) {
      missing.push(t.text);
      return t;
    }
    added += 1;
    return { ...t, text: `${han.trim()} ${py.trim()}` };
  });
  return { config: { ...(config as object), roleplay: { ...rp, turns } }, added, missing, kept };
}
