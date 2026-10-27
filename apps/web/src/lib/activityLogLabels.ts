/**
 * Nhãn tiếng Việt cho `LearningEvent.eventType` trong "Log hoạt động học viên".
 * Chỉ các hành vi học phổ biến; loại chưa có nhãn hiển thị nguyên tên sự kiện
 * (giảng viên vẫn đọc được, và không nuốt mất dòng log).
 */
const LABELS: Record<string, string> = {
  "lesson.viewed": "Mở bài học",
  "lesson.engaged": "Đọc / xem bài học",
  "lesson.completed": "Hoàn thành bài học",
  "lesson.pdf.opened_external": "Mở PDF trong tab mới",
  "lesson.annotation.created": "Ghi chú trong bài",
  "lesson.annotation.replied": "Trả lời ghi chú",
  "video.cuepoint.passed": "Qua câu hỏi trong video",
  "flashcard.reviewed": "Ôn flashcard",
  "quiz.started": "Bắt đầu quiz",
  "quiz.question.answered": "Trả lời câu hỏi quiz",
  "quiz.submitted": "Nộp quiz",
  "assignment.submitted": "Nộp bài tập",
  "assignment.graded": "Bài tập được chấm",
  "ai.tutor.asked": "Hỏi trợ lý AI",
  "forum.posted": "Đăng bài diễn đàn",
  "enrollment.section_changed": "Đổi lớp",
};

export function activityLogLabel(eventType: string): string {
  return LABELS[eventType] ?? eventType;
}
