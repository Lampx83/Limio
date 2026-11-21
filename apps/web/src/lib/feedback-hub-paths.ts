// Phần thuần của tích hợp Feedback Hub — an toàn để import từ component client (không đụng node:crypto).

/** Trang làm bài thi: ẩn nút nổi để thí sinh không bị xao nhãng hay mở khung nhập liệu giữa giờ thi. */
const EXAM_PREFIXES = ["/thi", "/exam-take", "/play", "/join"];
export const isExamPath = (pathname: string) =>
  EXAM_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
