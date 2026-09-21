/**
 * Ba bước của luồng kiểm tra đánh giá — Ngân hàng câu hỏi → Đề thi → Tổ chức thi —
 * và bước nào nên làm tiếp. Trước đây menu chỉ liệt kê ba mục cạnh nhau: giảng viên
 * mới không biết phải đi theo thứ tự nào. Hàm thuần để kiểm thử được.
 */

export type StepKey = "bank" | "exam" | "organize";
export type StepStatus = "done" | "current" | "waiting" | "skipped";

export interface AssessmentCounts {
  publishedQuestions: number;
  publishedExams: number;
  draftExams: number;
  /** Số buổi/ca thi do giảng viên tổ chức (không tính ca mặc định tự sinh). */
  sessions: number;
}

export interface AssessmentStep {
  key: StepKey;
  status: StepStatus;
  hint?: string;
}

export function computeAssessmentSteps(c: AssessmentCounts): {
  steps: AssessmentStep[];
  next: StepKey | "done";
} {
  const hasQuestions = c.publishedQuestions > 0;
  const hasExam = c.publishedExams > 0;
  const hasSession = c.sessions > 0;

  // Bước 1 không bắt buộc: đề có thể tự soạn câu hỏi, không lấy từ ngân hàng.
  // Có đề published rồi mà ngân hàng trống thì coi là "bỏ qua", không chặn ai.
  const bank: AssessmentStep = {
    key: "bank",
    status: hasQuestions ? "done" : hasExam ? "skipped" : "current",
  };
  const exam: AssessmentStep = {
    key: "exam",
    status: hasExam ? "done" : hasQuestions || hasSession ? "current" : "waiting",
    ...(!hasExam && c.draftExams > 0
      ? { hint: `Bạn có ${c.draftExams} đề còn nháp — mở đề và bấm Publish để dùng được.` }
      : {}),
  };
  const organize: AssessmentStep = {
    key: "organize",
    status: hasSession ? "done" : hasExam ? "current" : "waiting",
  };

  const steps = [bank, exam, organize];
  const current = steps.find((s) => s.status === "current");
  return { steps, next: current ? current.key : "done" };
}
