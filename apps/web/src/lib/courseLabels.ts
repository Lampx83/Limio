/**
 * Nhãn hiển thị cho siêu dữ liệu khoá học. Cột `Course.level` / `Course.language`
 * lưu mã ("beginner", "vi") — in thẳng ra là học viên thấy "beginner · vi".
 */
export const COURSE_LEVEL_LABEL: Record<string, string> = {
  beginner: "Cơ bản",
  intermediate: "Trung cấp",
  advanced: "Nâng cao",
};

export const COURSE_LANGUAGE_LABEL: Record<string, string> = {
  vi: "Tiếng Việt",
  en: "Tiếng Anh",
  zh: "Tiếng Trung",
};

export function courseLevelLabel(level: string): string {
  return COURSE_LEVEL_LABEL[level] ?? level;
}

export function courseLanguageLabel(language: string): string {
  return COURSE_LANGUAGE_LABEL[language] ?? language;
}

/**
 * Dòng nhỏ trên đầu trang khoá: trình độ, kèm ngôn ngữ khi khoá không dạy bằng
 * tiếng Việt (gần như mọi khoá là tiếng Việt — ghi ra chỉ thêm nhiễu).
 */
export function courseMetaLine(level: string, language: string): string {
  const parts = [courseLevelLabel(level)];
  if (language !== "vi") parts.push(courseLanguageLabel(language));
  return parts.join(" · ");
}

// Giảng viên thường tự đánh số trong tên module ("Module 3 · …", "Chương 2 — …",
// "Bài 5 …", "M1") — thêm tiền tố nữa thành "Module Module 3".
const NUMBERED_TITLE = /^(module|chương|phần|bài|tuần|unit|chapter|week|lesson|m\s?\d|\d)/i;

/**
 * Tiền tố đứng trước tên module trong danh sách, hoặc null nếu tên đã tự đánh
 * số. `index` tính từ 0 trên các module đang hiện.
 */
export function modulePrefix(title: string, index: number): string | null {
  return NUMBERED_TITLE.test(title.trim()) ? null : `Module ${index + 1}`;
}
