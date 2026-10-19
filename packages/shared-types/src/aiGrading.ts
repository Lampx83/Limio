/**
 * "Gợi ý điểm bằng AI" — giới hạn độ dài bài nộp gửi cho model.
 *
 * Đặt ở đây vì core-feedback (cắt bài trước khi gửi) lẫn apps/web (báo giảng viên "AI đọc khoảng 7 trang")
 * cùng cần một con số; hai bản lệch nhau thì lời cảnh báo nói sai.
 */

/** Tổng ký tự bài nộp (phần chữ + đính kèm) gửi cho model; phần chữ học viên gõ được lấy trước. */
export const AI_GRADE_CHAR_BUDGET = 20_000;

/** Ước lượng một trang A4 tiếng Việt, cỡ chữ thường — chỉ để quy ra "khoảng N trang" cho dễ hình dung. */
export const AI_GRADE_CHARS_PER_PAGE = 3_000;

/** Số trang AI đọc được, làm tròn (≈ 7). */
export const AI_GRADE_PAGE_LIMIT = Math.round(AI_GRADE_CHAR_BUDGET / AI_GRADE_CHARS_PER_PAGE);

/** "20.000" — viết sẵn kiểu Việt để server và trình duyệt hiển thị giống nhau (không phụ thuộc locale máy). */
export const AI_GRADE_CHAR_BUDGET_TEXT = AI_GRADE_CHAR_BUDGET.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** Quy số ký tự ra số trang ước lượng (ít nhất 1). */
export function estimatePages(chars: number): number {
  return Math.max(1, Math.round(chars / AI_GRADE_CHARS_PER_PAGE));
}
