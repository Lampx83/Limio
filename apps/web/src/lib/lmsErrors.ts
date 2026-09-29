/**
 * Thông báo tiếng Việt cho mã lỗi của các API soạn khoá học (module, bài học,
 * nội dung, quiz, bài tập, xuất bản, upload) — để UI giảng viên không bao giờ
 * hiện mã thô (`order_index_taken`, `empty_content`…).
 *
 * Cùng phong cách với `enrollErrorMessage`. Mã không nhận ra → câu chung theo
 * `status`, còn mã gốc vẫn nên được `console.error` ở nơi gọi để dễ gỡ lỗi.
 */
const LMS_ERROR_MESSAGES: Record<string, string> = {
  // Chung
  unauthorized: "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại rồi thử lại.",
  forbidden: "Bạn không có quyền thực hiện thao tác này.",
  not_found: "Không tìm thấy mục này. Có thể nó vừa bị xoá — hãy tải lại trang.",
  validation_failed: "Thông tin chưa hợp lệ. Vui lòng kiểm tra lại các ô đã nhập.",
  rate_limited: "Bạn thao tác quá nhanh, vui lòng đợi một chút rồi thử lại.",
  internal_error: "Máy chủ đang gặp sự cố. Vui lòng thử lại sau ít phút.",
  server_error: "Máy chủ đang gặp sự cố. Vui lòng thử lại sau ít phút.",
  network_error: "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.",

  // Module, bài học
  order_index_taken: "Có người vừa thêm mục khác cùng lúc. Hãy tải lại trang rồi thử lại.",

  // Nội dung
  empty_content: "Bạn chưa nhập nội dung.",
  missing_scorm_package: "Bạn chưa chọn gói SCORM.",
  missing_h5p_package: "Bạn chưa chọn gói H5P.",
  missing_lti_tool: "Bạn chưa chọn công cụ LTI.",
  create_failed: "Không tạo được mục này. Vui lòng thử lại.",
  duplicate_cuepoint_quiz:
    "Hai câu hỏi gài trong video đang dùng chung một quiz. Hãy chọn quiz khác cho mỗi mốc thời gian.",
  cuepoint_quiz_failed: "Không lưu được câu hỏi gài trong video. Vui lòng thử lại.",

  // Upload
  file_too_large: "File quá lớn so với giới hạn cho phép.",
  unsupported_media_type: "Định dạng file này chưa được hỗ trợ.",
  convert_failed: "Không xử lý được file này. Hãy kiểm tra file rồi tải lên lại.",
  upload_failed: "Tải file lên không thành công. Vui lòng thử lại.",
  package_unpacked_too_large:
    "Gói này quá lớn sau khi giải nén (tối đa 1 GB). Hãy giảm dung lượng video/ảnh trong gói rồi xuất lại.",
  package_too_many_files: "Gói này có quá nhiều file (tối đa 20.000). Hãy rút gọn gói rồi xuất lại.",

  // Bài tập
  ai_failed: "AI chưa trả lời được lúc này. Vui lòng thử lại sau ít phút.",

  // Xuất bản
  lessons_missing_skills:
    "Còn bài học chưa được gắn chủ đề nên chưa xuất bản được. Hãy mở các bài được liệt kê và gắn chủ đề.",
  invalid_status_transition: "Khoá học đã lưu trữ nên không thể xuất bản.",
  publish_failed: "Không xuất bản được khoá học. Vui lòng thử lại.",
};

export function lmsErrorMessage(code: unknown, status?: number): string {
  if (typeof code === "string") {
    if (LMS_ERROR_MESSAGES[code]) return LMS_ERROR_MESSAGES[code];
    // Mã có hậu tố chi tiết, ví dụ `upload_failed: 500` hoặc `cuepoint_quiz_failed: ...`.
    const prefix = code.split(":")[0]!.trim();
    if (LMS_ERROR_MESSAGES[prefix]) return LMS_ERROR_MESSAGES[prefix];
  }
  if (status && status >= 500) return LMS_ERROR_MESSAGES.server_error!;
  if (status === 401) return LMS_ERROR_MESSAGES.unauthorized!;
  if (status === 403) return LMS_ERROR_MESSAGES.forbidden!;
  if (status === 404) return LMS_ERROR_MESSAGES.not_found!;
  return "Thao tác không thành công. Vui lòng thử lại.";
}
