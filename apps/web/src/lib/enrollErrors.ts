/**
 * Thông báo tiếng Việt cho mã lỗi của các API ghi danh — để UI không bao giờ
 * hiện mã thô (`invite_required`, `not_found`…) cho người dùng.
 */
const ENROLL_ERROR_MESSAGES: Record<string, string> = {
  unauthorized: "Bạn cần đăng nhập để đăng ký khoá học.",
  not_found: "Không tìm thấy khoá học này. Có thể khoá đã bị gỡ — hãy tải lại trang.",
  course_not_found: "Không tìm thấy khoá học này. Có thể khoá đã bị gỡ — hãy tải lại trang.",
  course_not_enrollable: "Khoá học này hiện chưa mở đăng ký (chưa xuất bản hoặc đã đóng).",
  invite_required: "Khoá học này chỉ nhận học viên qua link mời của giảng viên. Hãy xin link mời lớp.",
  invalid_invite_code: "Link mời không còn hiệu lực. Hãy xin giảng viên link mới.",
  payment_required: "Khoá học này có phí. Hãy nhập mã kích hoạt hoặc thanh toán để đăng ký.",
  rate_limited: "Bạn thao tác quá nhanh, vui lòng đợi một chút rồi thử lại.",
  server_error: "Máy chủ đang gặp sự cố. Vui lòng thử lại sau ít phút.",
  network_error: "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.",
};

export function enrollErrorMessage(code: unknown, status?: number): string {
  if (typeof code === "string" && ENROLL_ERROR_MESSAGES[code]) return ENROLL_ERROR_MESSAGES[code];
  if (status && status >= 500) return "Máy chủ đang gặp sự cố. Vui lòng thử lại sau ít phút.";
  if (status === 403) return "Bạn không có quyền đăng ký khoá học này.";
  return "Đăng ký không thành công. Vui lòng thử lại sau.";
}
