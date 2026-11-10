/**
 * Loại câu hỏi mà trình làm bài đề thi (`ExamQuestion`) vẽ được: đủ 10 loại của trình soạn (từ mục C của
 * docs/tieu-chi/exam-loai-cau-va-dan-anh-doan-van.md; trước đó Sắp xếp, Ghép cặp, Số, Kéo thả điền tạm bị ẩn khỏi bộ chọn). Thêm loại
 * câu mới thì thêm vào đây — một chỗ duy nhất; loại nào chưa có ở đây thì bộ chọn không cho tạo và câu cũ hiện nhãn cảnh báo.
 */
export const PLAYABLE_EXAM_QUESTION_TYPES = [
  "mcq",
  "multi",
  "true_false_notgiven",
  "gap_fill",
  "short_answer",
  "essay",
  "ordering",
  "matching",
  "numerical",
  "drag_drop_fill",
] as const;

export function isPlayableExamQuestionType(type: string): boolean {
  return (PLAYABLE_EXAM_QUESTION_TYPES as readonly string[]).includes(type);
}

/** Nhãn cảnh báo cho giảng viên cạnh câu thuộc loại chưa làm được. */
export const UNPLAYABLE_TYPE_BADGE = "Chưa làm được";
export const UNPLAYABLE_TYPE_HINT = "Loại câu này chưa làm được trong bài, nên đổi sang loại khác.";

/** Câu học viên thấy khi gặp câu thuộc loại chưa vẽ được (thay cho dòng tiếng Anh đỏ trước đây). */
export const UNPLAYABLE_FOR_LEARNER = "Câu này chưa hiển thị được. Báo giảng viên.";
