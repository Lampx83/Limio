export type NoteSizeId = "sm" | "md" | "lg" | "xl";

// px: xem trước trong trang thường. vh: chế độ toàn màn hình (chiếu cho cả lớp).
export const NOTE_SIZES: { id: NoteSizeId; label: string; px: number; vh: number }[] = [
  { id: "sm", label: "Nhỏ", px: 16, vh: 3 },
  { id: "md", label: "Vừa", px: 24, vh: 5 },
  { id: "lg", label: "Lớn", px: 36, vh: 8 },
  { id: "xl", label: "Rất lớn", px: 56, vh: 12 },
];

export const DEFAULT_NOTE_SIZE: NoteSizeId = "md";

export function normalizeNoteSize(v: string | null | undefined): NoteSizeId {
  return NOTE_SIZES.find((s) => s.id === v)?.id ?? DEFAULT_NOTE_SIZE;
}

const HTML_TAG = /<\/?(?:p|div|br|h[1-6]|ul|ol|li|span|b|i|u|strong|em|font|mark)\b[^>]*>/i;

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

// Ghi chú cũ lưu dạng HTML (trình soạn thảo có định dạng). Đổi sang chữ thường để hiện
// trong ô nhập mới; chữ thường sẵn có thì giữ nguyên.
export function noteToPlainText(raw: string | null | undefined): string {
  if (!raw) return "";
  if (!HTML_TAG.test(raw)) return raw;
  const text = raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "- ")
    .replace(/<\/(?:p|div|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m] ?? m)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
  return text.trim();
}
