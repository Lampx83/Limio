// Câu về ngôn ngữ trong các câu lệnh soạn bài giảng Limio-Live (docs/tieu-chi/ngon-ngu-slide.md, L7–L10).
import { DECK_LANGUAGES } from "@feedbackme/shared-types";

/** "tiếng Anh"… cho mã ngôn ngữ của bài; null khi mã không thuộc danh sách. */
export function deckLanguageName(code: string | null | undefined): string | null {
  const l = DECK_LANGUAGES.find((x) => x.code === code);
  return l ? l.label.charAt(0).toLowerCase() + l.label.slice(1) : null;
}

/**
 * Câu quy định ngôn ngữ viết nội dung slide. `terms` nói khi nào giữ thuật ngữ tiếng Anh (chỉ áp cho bài tiếng Việt).
 * Bài chưa xác định ngôn ngữ: theo ngôn ngữ của nguồn (tài liệu, mô tả hoặc nội dung hiện có), không rõ thì tiếng Việt.
 */
export function slideLanguageRule(code: string | null | undefined, terms: string): string {
  const vi = `Viết bằng tiếng Việt (giữ nguyên thuật ngữ tiếng Anh nếu ${terms}).`;
  if (code === "vi") return vi;
  const name = deckLanguageName(code);
  if (!name) {
    return `Viết bằng cùng ngôn ngữ với nguồn của bài (tài liệu, mô tả của giảng viên hoặc nội dung hiện có của slide); nếu không rõ thì viết bằng tiếng Việt (giữ nguyên thuật ngữ tiếng Anh nếu ${terms}).`;
  }
  return `Viết TOÀN BỘ nội dung slide (tiêu đề, ý, câu hỏi, phương án, đề bài, ghi chú giảng) bằng ${name}, kể cả khi chỉ dẫn này viết bằng tiếng Việt và nguồn viết bằng tiếng khác; các cụm mặc định nêu trong chỉ dẫn (ví dụ "Thông điệp chính của bài học") cũng viết bằng ${name}.`;
}
