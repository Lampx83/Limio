/**
 * Cỡ chữ của đoạn chữ được chọn trong Đoạn văn (docs/tieu-chi/exam-loai-cau-va-dan-anh-doan-van.md, mục D): bốn mức cố định,
 * không cho gõ số tuỳ ý để bài đọc đồng đều và an toàn. `value` null = cỡ mặc định. Module nhẹ (không kéo Tiptap) vì phía học
 * viên (`PassageView`) cũng dùng để kiểm tra giá trị trước khi vẽ.
 */
export const PASSAGE_FONT_SIZES: ReadonlyArray<{ label: string; value: string | null }> = [
  { label: "Nhỏ", value: "0.875rem" },
  { label: "Thường", value: null },
  { label: "Lớn", value: "1.25rem" },
  { label: "Rất lớn", value: "1.5rem" },
];

export const PASSAGE_FONT_SIZE_VALUES: ReadonlySet<string> = new Set(
  PASSAGE_FONT_SIZES.map((s) => s.value).filter((v): v is string => v !== null),
);
