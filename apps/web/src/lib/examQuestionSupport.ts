/**
 * Loại câu hỏi mà trình làm bài đề thi (`ExamQuestion`) vẽ được. Trình soạn và máy chủ nhận 10 loại, nhưng trình làm bài mới có 6:
 * Sắp xếp, Ghép cặp, Số, Kéo thả điền chưa có giao diện (và máy chủ chưa gửi cấu hình của chúng xuống trình duyệt). Xem
 * docs/tieu-chi/exam-loai-cau-va-dan-anh-doan-van.md. Khi mục C làm xong thì thêm 4 loại vào đây — một chỗ duy nhất.
 */
export const PLAYABLE_EXAM_QUESTION_TYPES = [
  "mcq",
  "multi",
  "true_false_notgiven",
  "gap_fill",
  "short_answer",
  "essay",
] as const;

export function isPlayableExamQuestionType(type: string): boolean {
  return (PLAYABLE_EXAM_QUESTION_TYPES as readonly string[]).includes(type);
}

/** Nhãn cảnh báo cho giảng viên cạnh câu thuộc loại chưa làm được. */
export const UNPLAYABLE_TYPE_BADGE = "Chưa làm được";
export const UNPLAYABLE_TYPE_HINT = "Loại câu này chưa làm được trong bài, nên đổi sang loại khác.";

/** Câu học viên thấy khi gặp câu thuộc loại chưa vẽ được (thay cho dòng tiếng Anh đỏ trước đây). */
export const UNPLAYABLE_FOR_LEARNER = "Câu này chưa hiển thị được. Báo giảng viên.";
