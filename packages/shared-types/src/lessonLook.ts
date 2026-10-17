/**
 * Hình thức của bài học văn bản (ContentItem richtext): bảng màu + kiểu chữ
 * cho cả bài, bố cục cho từng mục, loại khối. Tách nội dung khỏi trang trí —
 * HTML của bài chỉ mang tên bố cục/tên khối (data-layout, data-kind), còn màu
 * và chữ do bảng màu quyết định lúc hiển thị. Nhờ vậy sửa tay trong trình soạn
 * thảo không làm hỏng hình thức, và đổi bảng màu không phải gọi AI.
 *
 * Đặt ở shared-types vì cả core-lms (kiểm payload) lẫn web (hiển thị, trình
 * soạn) đều cần, và sau này core-feedback (AI sinh bài) cũng cần.
 */

export const LESSON_PALETTE_KEYS = ["limio", "paper", "forest", "sunset", "vibrant", "plain"] as const;
export type LessonPaletteKey = (typeof LESSON_PALETTE_KEYS)[number];

export const LESSON_PALETTE_LABELS: Record<LessonPaletteKey, string> = {
  limio: "Xanh Limio",
  paper: "Giấy ấm",
  forest: "Rừng thông",
  sunset: "Hoàng hôn",
  vibrant: "Sinh động",
  plain: "Trang nhã",
};

export const LESSON_PALETTE_HINTS: Record<LessonPaletteKey, string> = {
  limio: "Xanh dương, gọn gàng, hợp với đa số bài.",
  paper: "Nền kem ấm, dễ chịu khi đọc bài dài.",
  forest: "Xanh lá dịu, hợp bài khoa học, môi trường.",
  sunset: "Cam đất, nổi bật, hợp bài sáng tạo.",
  vibrant: "Mỗi mục lớn một màu, dễ phân biệt khi bài nhiều mục.",
  plain: "Đơn sắc, trang nhã, hợp để in.",
};

export const LESSON_FONT_KEYS = ["modern", "readable", "academic"] as const;
export type LessonFontKey = (typeof LESSON_FONT_KEYS)[number];

export const LESSON_FONT_LABELS: Record<LessonFontKey, string> = {
  modern: "Hiện đại",
  readable: "Dễ đọc",
  academic: "Học thuật",
};

export const LESSON_FONT_HINTS: Record<LessonFontKey, string> = {
  modern: "Chữ không chân Be Vietnam Pro.",
  readable: "Chữ Lexend, nét rộng, dễ đọc trên màn hình nhỏ.",
  academic: "Tiêu đề có chân, nội dung không chân.",
};

export interface LessonLook {
  palette: LessonPaletteKey;
  font: LessonFontKey;
}

export const DEFAULT_LESSON_LOOK: LessonLook = { palette: "limio", font: "modern" };

export function isLessonPaletteKey(v: unknown): v is LessonPaletteKey {
  return typeof v === "string" && (LESSON_PALETTE_KEYS as readonly string[]).includes(v);
}

export function isLessonFontKey(v: unknown): v is LessonFontKey {
  return typeof v === "string" && (LESSON_FONT_KEYS as readonly string[]).includes(v);
}

/** Đọc `payload.look` không tin cậy (JSON trong DB) — sai thì coi như chưa chọn. */
export function readLessonLook(v: unknown): LessonLook | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (!isLessonPaletteKey(o.palette) || !isLessonFontKey(o.font)) return null;
  return { palette: o.palette, font: o.font };
}

/** Bố cục của một mục lớn (`<section class="lesson-section" data-layout>`). */
export const LESSON_LAYOUT_KEYS = ["text", "image", "cards", "compare", "steps", "faq", "stats"] as const;
export type LessonLayoutKey = (typeof LESSON_LAYOUT_KEYS)[number];

export const LESSON_LAYOUT_LABELS: Record<LessonLayoutKey, string> = {
  text: "Văn bản",
  image: "Chữ và ảnh",
  cards: "Thẻ khái niệm",
  compare: "So sánh hai cột",
  steps: "Các bước",
  faq: "Hỏi và đáp",
  stats: "Số liệu nổi bật",
};

export const LESSON_LAYOUT_HINTS: Record<LessonLayoutKey, string> = {
  text: "Đoạn văn và các phần con nối tiếp nhau.",
  image: "Ảnh của mục nằm một bên, chữ một bên.",
  cards: "Mỗi phần là một thẻ, xếp thành lưới.",
  compare: "Các phần xếp thành hai cột để đối chiếu.",
  steps: "Các phần được đánh số theo trình tự.",
  faq: "Tiêu đề phần là câu hỏi, bấm để mở câu trả lời.",
  stats: "Tiêu đề phần là con số lớn, nội dung là chú thích.",
};

export function isLessonLayoutKey(v: unknown): v is LessonLayoutKey {
  return typeof v === "string" && (LESSON_LAYOUT_KEYS as readonly string[]).includes(v);
}

/** Loại hộp (`<div class="lesson-box" data-kind>`). */
export const LESSON_BOX_KINDS = ["objectives", "summary", "note", "example", "definition"] as const;
export type LessonBoxKind = (typeof LESSON_BOX_KINDS)[number];

/** Tên mặc định của hộp — cũng là tiêu đề hiện ra khi giảng viên không đặt tên riêng. */
export const LESSON_BOX_LABELS: Record<LessonBoxKind, string> = {
  objectives: "Mục tiêu học tập",
  summary: "Tổng kết",
  note: "Lưu ý",
  example: "Ví dụ",
  definition: "Định nghĩa",
};

export function isLessonBoxKind(v: unknown): v is LessonBoxKind {
  return typeof v === "string" && (LESSON_BOX_KINDS as readonly string[]).includes(v);
}
