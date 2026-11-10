/**
 * Bảng màu của Đoạn văn (docs/tieu-chi/exam-loai-cau-va-dan-anh-doan-van.md, mục D): màu chữ và màu tô nổi, cùng bảng với trình soạn bài
 * học. Chỉ nhận màu trong bảng (không cho gõ màu tuỳ ý) để bài đọc đồng đều và an toàn. Module nhẹ (không kéo Tiptap) vì phía học viên
 * (`PassageView`) cũng dùng để kiểm tra giá trị trước khi vẽ.
 */
export const PASSAGE_TEXT_COLORS: ReadonlyArray<{ name: string; value: string }> = [
  { name: "Đen", value: "#111827" },
  { name: "Xám", value: "#6b7280" },
  { name: "Đỏ", value: "#dc2626" },
  { name: "Cam", value: "#ea580c" },
  { name: "Vàng đậm", value: "#ca8a04" },
  { name: "Xanh lá", value: "#16a34a" },
  { name: "Xanh dương", value: "#2563eb" },
  { name: "Tím", value: "#7c3aed" },
  { name: "Hồng", value: "#db2777" },
];

export const PASSAGE_HIGHLIGHT_COLORS: ReadonlyArray<{ name: string; value: string }> = [
  { name: "Vàng", value: "#fef08a" },
  { name: "Xanh lá", value: "#bbf7d0" },
  { name: "Xanh dương", value: "#bfdbfe" },
  { name: "Hồng", value: "#fbcfe8" },
  { name: "Cam", value: "#fed7aa" },
  { name: "Tím", value: "#ddd6fe" },
];

const TEXT_SET: ReadonlySet<string> = new Set(PASSAGE_TEXT_COLORS.map((c) => c.value));
const HIGHLIGHT_SET: ReadonlySet<string> = new Set(PASSAGE_HIGHLIGHT_COLORS.map((c) => c.value));

/** Đưa mọi dạng màu trình duyệt trả ra (`#ABC`, `#aabbcc`, `rgb(r, g, b)`) về `#rrggbb` thường; không hiểu thì null. */
export function normalizeColor(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(s);
  if (hex) {
    const h = hex[1]!;
    return h.length === 3 ? `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}` : `#${h}`;
  }
  const rgb = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*[\d.]+\s*)?\)$/.exec(s);
  if (rgb) {
    const to = (n: string) => Math.min(255, Number(n)).toString(16).padStart(2, "0");
    return `#${to(rgb[1]!)}${to(rgb[2]!)}${to(rgb[3]!)}`;
  }
  return null;
}

/** Màu chữ hợp lệ (trong bảng) ở dạng `#rrggbb`, hoặc null. */
export function passageTextColor(v: unknown): string | null {
  const c = normalizeColor(v);
  return c && TEXT_SET.has(c) ? c : null;
}

/** Màu tô nổi hợp lệ (trong bảng) ở dạng `#rrggbb`, hoặc null (null = tô nổi màu mặc định). */
export function passageHighlightColor(v: unknown): string | null {
  const c = normalizeColor(v);
  return c && HIGHLIGHT_SET.has(c) ? c : null;
}
