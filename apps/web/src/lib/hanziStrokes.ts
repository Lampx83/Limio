/** Chữ Hán trong một từ, theo thứ tự (bỏ dấu câu, chữ Latinh). Dùng cho nút "Cách viết" của thẻ từ mới. */
const HAN_CHAR = /[㐀-䶿一-鿿]/g;

export function hanChars(term: string): string[] {
  return term.match(HAN_CHAR) ?? [];
}

/** Đường dẫn file nét của một chữ (chép sẵn vào public/hanzi bằng scripts/sync-hanzi-strokes.ts). */
export function hanziDataPath(ch: string): string {
  return `/hanzi/${encodeURIComponent(ch)}.json`;
}
