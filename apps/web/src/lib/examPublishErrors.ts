/**
 * Việt hoá lỗi khi publish đề. `publishExam` trả về các câu điều kiện bằng tiếng
 * Anh kỹ thuật ("openAt must be before closeAt", có cả id nội bộ) — giảng viên
 * không đọc được và không biết phải làm gì. Đặt ở phía giao diện để không đổi
 * chuỗi mà các test/nhà tích hợp khác có thể đang dựa vào.
 */

export function humanizePublishError(code: string): string {
  switch (code) {
    case "exam_not_publishable":
      return "Đề chưa đủ điều kiện để publish. Xử lý các mục dưới đây rồi thử lại:";
    case "exam_not_draft":
      return "Đề này đã publish rồi.";
    case "forbidden":
      return "Bạn không có quyền publish đề này.";
    case "unauthorized":
      return "Phiên đăng nhập đã hết. Hãy đăng nhập lại rồi thử lại.";
    case "exam_not_found":
      return "Không tìm thấy đề (có thể đã bị xoá).";
    default:
      return `Chưa publish được (mã: ${code}). Thử lại; nếu vẫn lỗi, báo quản trị.`;
  }
}

export function humanizePublishDetail(raw: string): string {
  if (raw === "openAt must be before closeAt")
    return "Giờ mở đề phải trước giờ đóng đề.";
  if (raw === "durationMin must be positive")
    return "Thời lượng làm bài phải lớn hơn 0 phút.";
  if (raw === "oral exam has no material")
    return "Đề vấn đáp chưa có tài liệu nào. Thêm ít nhất một tài liệu ở tab Tài liệu.";
  if (raw === "exam has no passages, standalone questions, or random sections")
    return "Đề chưa có câu hỏi nào. Thêm câu hỏi ở tab Nội dung.";
  if (/^passage \S+ has no questions$/.test(raw))
    return "Có đoạn văn chưa có câu hỏi nào. Thêm câu hỏi cho đoạn đó hoặc xoá đoạn.";
  if (raw === "total points must be > 0")
    return "Tổng điểm của đề phải lớn hơn 0. Kiểm tra điểm của từng câu.";
  // Đã là tiếng Việt (do chính server soạn) hoặc chưa biết: giữ nguyên.
  return raw;
}
