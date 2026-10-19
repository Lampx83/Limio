// Câu hỏi đề xuất hiện sẵn khi giảng viên mở Lily (ngăn kéo). Gợi ý theo trang đang đứng: ở "Tổ chức thi" thì gợi ý về
// link thi nhanh và danh sách thí sinh, ở "Bài giảng của tôi" thì gợi ý về PowerPoint và mã QR... Hoàn toàn cố định,
// không gọi mô hình. Mỗi câu phải có mục trong kho hướng dẫn để Lily trả lời được (test kiểm), và không chạm vào việc
// dò hỏi kỹ thuật.

interface Group {
  match: RegExp;
  questions: readonly string[];
}

const GROUPS: readonly Group[] = [
  {
    match: /^\/instructor\/(organize|exam-sessions|exam-history|exam-runs|exam-rounds|my-rooms)/,
    questions: ["Làm sao tạo link thi nhanh cho lớp?", "Cách tạo ca thi chính thức và nhập danh sách thí sinh", "Xem kết quả và xuất bảng điểm ở đâu?"],
  },
  {
    match: /^\/instructor\/(exams|question-banks|assessment)/,
    questions: ["Cách tạo đề thi từ ngân hàng câu hỏi", "Cách nhập câu hỏi từ Excel vào ngân hàng", "Đặt trọng số theo phần cho đề thi thế nào?"],
  },
  {
    match: /^\/instructor\/limio-live/,
    questions: ["Tạo bài giảng từ file PowerPoint thế nào?", "Cách chiếu mã QR cho học viên tương tác", "Chia sẻ bài giảng bằng link và tải PDF"],
  },
  {
    match: /^\/instructor\/(teaching-tools|gameshow)/,
    questions: ["Dùng Vote và Word Cloud mở đầu buổi học thế nào?", "Cách chia nhóm và đặt đếm ngược", "Xoá và khôi phục phiên trong thùng rác ở đâu?"],
  },
  {
    match: /^\/instructor\/(assignments|grade-essays)/,
    questions: ["Chấm bài tập nhanh bằng Chấm & bài tiếp thế nào?", "Nhập rubric để AI gợi ý điểm ở đâu?", "Bài tập nộp theo nhóm chấm thế nào?"],
  },
  {
    match: /^\/instructor\/courses/,
    questions: ["Cách thêm bài học từ tài liệu Word bằng AI", "Tạo lớp và gửi link mời cho học viên", "Đặt hạn nộp riêng cho từng lớp"],
  },
  {
    match: /^\/instructor\/forum/,
    questions: ["Trả lời câu hỏi chưa giải đáp trên diễn đàn thế nào?", "Đánh dấu câu trả lời đúng ở diễn đàn ra sao?"],
  },
  {
    match: /^\/instructor\/(learner-insights|enrollments)/,
    questions: ["Xem học viên đang vướng chủ đề nào ở đâu?", "Xem học viên im ắng nhiều ngày ở đâu?"],
  },
  {
    match: /^\/instructor\/oral-exams/,
    questions: ["Soạn đề vấn đáp cho AI hỏi học viên thế nào?", "Nhập rubric cho buổi vấn đáp ở đâu?"],
  },
  {
    match: /^\/instructor\/tournaments/,
    questions: ["Tổ chức đấu trường có nhiệm vụ chấm chéo thế nào?"],
  },
];

/** Gợi ý chung khi trang không có nhóm riêng (hoặc để bổ sung cho đủ số lượng). */
const GENERAL: readonly string[] = [
  "Hôm nay tôi nên làm gì trước?",
  "Tạo bài giảng tương tác từ tài liệu thế nào?",
  "Cách tạo đề thi từ ngân hàng câu hỏi",
  "Làm sao tạo link thi nhanh cho lớp?",
  "Nhập rubric để AI gợi ý điểm ở đâu?",
];

export const MAX_SUGGESTIONS = 4;
/** Câu mở đầu luôn có (không cần hướng dẫn riêng: Lily xem tình hình của giảng viên để gợi ý). */
export const IDEA_QUESTION = "Hôm nay tôi nên làm gì trước?";

/** Tất cả câu có thể xuất hiện (cho test). */
export function allSuggestions(): string[] {
  return [...new Set([...GROUPS.flatMap((g) => g.questions), ...GENERAL])];
}

/** Tên khoá dài hơn mức này thì cắt (kèm "…") để nút gợi ý không chiếm cả khung. */
const COURSE_TITLE_MAX = 44;

/** Câu gợi ý mở khoá gần đây nhất của giảng viên, vd `Mở khoá học "Thiết kế UI/UX"`. Rỗng nếu chưa có khoá. */
export function openCourseQuestion(courseTitle: string | null | undefined): string | null {
  const title = (courseTitle ?? "").replace(/\s+/g, " ").trim();
  if (!title) return null;
  const shown = title.length > COURSE_TITLE_MAX ? `${title.slice(0, COURSE_TITLE_MAX - 1).trimEnd()}…` : title;
  return `Mở khoá học "${shown}"`;
}

/**
 * Tối đa MAX_SUGGESTIONS câu cho trang `pathname`: các câu của nhóm khớp trang đứng trước, rồi (nếu còn chỗ) câu mở khoá
 * gần đây của giảng viên, rồi bổ sung từ gợi ý chung cho đủ. Câu "Hôm nay tôi nên làm gì trước?" luôn có mặt (chiếm chỗ
 * cuối nếu nhóm đã đủ).
 */
export function suggestionsFor(pathname: string | null | undefined, recentCourseTitle?: string | null): string[] {
  const group = GROUPS.find((g) => g.match.test(pathname ?? ""));
  const picked: string[] = [...(group?.questions ?? [])].slice(0, MAX_SUGGESTIONS - 1);
  const openCourse = openCourseQuestion(recentCourseTitle);
  if (openCourse && picked.length < MAX_SUGGESTIONS - 1) picked.push(openCourse);
  for (const q of GENERAL) {
    if (picked.length >= MAX_SUGGESTIONS - 1) break;
    if (q !== IDEA_QUESTION && !picked.includes(q)) picked.push(q);
  }
  return [...picked, IDEA_QUESTION];
}
