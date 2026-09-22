/**
 * "Định dạng bằng AI" — 4 template hiển thị (màu/font/cỡ chữ) giảng viên chọn
 * trước khi AI định dạng lại nội dung thô đã dán. Dùng chung giữa UI
 * (apps/web) và generator (core-feedback) nên đặt ở đây — không bên nào
 * import bên kia (§4.3 CLAUDE.md).
 */
export type LessonFormatTemplateKey = "clean" | "academic" | "modern" | "vibrant";

export const LESSON_FORMAT_TEMPLATE_KEYS: LessonFormatTemplateKey[] = [
  "clean",
  "academic",
  "modern",
  "vibrant",
];

export const LESSON_FORMAT_TEMPLATE_LABELS: Record<LessonFormatTemplateKey, string> = {
  clean: "Sạch sẽ",
  academic: "Học thuật",
  modern: "Hiện đại",
  vibrant: "Sinh động",
};

/** Ghi chú ngắn hiện cạnh mỗi thẻ theme để GV chọn đúng, không cần đoán. */
export const LESSON_FORMAT_TEMPLATE_HINTS: Record<LessonFormatTemplateKey, string> = {
  clean: "Chữ gọn, xanh dương — hợp bài hướng dẫn.",
  academic: "Tiêu đề chữ serif — hợp bài lý thuyết.",
  modern: "Tiêu đề nổi bật — hợp bài thiết kế sáng tạo.",
  vibrant: "Mỗi mục một màu riêng — dễ phân biệt khi bài nhiều mục (giống khoá Thiết kế UI/UX).",
};

export function isLessonFormatTemplateKey(v: unknown): v is LessonFormatTemplateKey {
  return typeof v === "string" && (LESSON_FORMAT_TEMPLATE_KEYS as string[]).includes(v);
}
