/**
 * "Định dạng bằng AI" — 3 template hiển thị (màu/font/cỡ chữ) giảng viên chọn
 * trước khi AI định dạng lại nội dung thô đã dán. Dùng chung giữa UI
 * (apps/web) và generator (core-feedback) nên đặt ở đây — không bên nào
 * import bên kia (§4.3 CLAUDE.md).
 */
export type LessonFormatTemplateKey = "clean" | "academic" | "modern";

export const LESSON_FORMAT_TEMPLATE_KEYS: LessonFormatTemplateKey[] = [
  "clean",
  "academic",
  "modern",
];

export const LESSON_FORMAT_TEMPLATE_LABELS: Record<LessonFormatTemplateKey, string> = {
  clean: "Sạch sẽ",
  academic: "Học thuật",
  modern: "Hiện đại",
};

export function isLessonFormatTemplateKey(v: unknown): v is LessonFormatTemplateKey {
  return typeof v === "string" && (LESSON_FORMAT_TEMPLATE_KEYS as string[]).includes(v);
}
