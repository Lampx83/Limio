/**
 * LANG G7 — chữ hiển thị cho góp ý bài nói. Dùng chung nhãn danh mục/mức với góp ý Viết
 * (writingFeedbackText) — ở đây chỉ phần riêng: ghi chú giới hạn phát âm và lời nhắn cho từng mã lỗi.
 */

/** G7c.1 — ghi chú cố định ở MỌI nơi hiện góp ý bài nói. */
export const SPEAKING_NOTICE =
  "Máy chỉ nghe ra chữ và nhịp nói; không chấm được phát âm hay thanh điệu. Giảng viên nghe bản ghi để đánh giá phát âm.";

export const SPEAKING_CONSENT =
  "Khi bấm, bản ghi âm của bạn được gửi tới OpenAI để chuyển thành chữ, rồi nội dung đó được AI phân tích. Việc này trừ lượt AI trong ví của bạn theo thời lượng bản ghi (không trừ lại khi bản ghi chưa đổi).";

export function describeSpeakingError(code: string | undefined): string {
  switch (code) {
    case "no_token_budget":
      return "Bạn đã dùng hết lượt AI của tháng này, nên chưa nhận được góp ý. Lượt AI sẽ được cấp lại đầu tháng sau, hoặc bạn có thể mua thêm.";
    case "global_token_cap":
    case "daily_token_cap":
      return "Hệ thống đang vượt hạn mức dùng AI hôm nay — thử lại sau.";
    case "rate_limited":
      return "Bài nói này đã được chấm 3 lần trong 24 giờ qua. Hãy ghi âm lại rồi thử sau, hoặc nhờ giảng viên góp ý.";
    case "audio_missing":
      return "Bài nộp chưa có bản ghi âm — hãy ghi âm hoặc tải file lên rồi nộp lại.";
    case "audio_not_hosted":
      return "Chỉ chấm được bản ghi âm đã tải lên hệ thống. Link ngoài (Drive, YouTube...) thì chưa nhận được góp ý.";
    case "audio_too_large":
      return "File ghi âm lớn hơn 25 MB nên chưa chuyển thành chữ được. Hãy ghi âm ngắn hơn (tối đa 3 phút).";
    case "audio_too_long":
      return "Bản ghi âm dài hơn 3 phút nên chưa chấm được. Hãy ghi âm lại ngắn hơn.";
    case "no_speech":
      return "Máy không nghe thấy tiếng nói trong bản ghi. Kiểm tra micro rồi ghi âm lại. (Lượt chuyển văn bản này vẫn bị tính.)";
    case "stt_failed":
      return "Chưa chuyển được bản ghi thành chữ. Lượt AI của bạn chưa bị trừ — hãy thử lại sau ít phút.";
    case "control_group":
      return "Lớp của bạn không dùng tính năng góp ý bằng AI.";
    case "not_language_course":
      return "Tính năng này chỉ dành cho khoá ngoại ngữ.";
    case "forbidden":
      return "Bạn chỉ nhận được góp ý cho bài của chính mình.";
    case "submission_not_found":
      return "Không tìm thấy bài nộp.";
    case "openai_not_configured":
      return "Hệ thống chưa cấu hình AI — hãy báo quản trị viên.";
    case "openai_error":
    case "json_parse_failed":
    case "analysis_empty":
      return "AI xử lý không thành công. Bản ghi của bạn đã được chuyển thành chữ nên lần thử lại sẽ không bị tính phí chuyển văn bản — hãy thử lại sau ít phút.";
    case "unauthorized":
      return "Phiên đăng nhập đã hết hạn — hãy tải lại trang.";
    default:
      return "Chưa nhận được góp ý. Vui lòng thử lại sau.";
  }
}
