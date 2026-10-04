/**
 * LANG G6 — chữ hiển thị cho góp ý bài viết: nhãn danh mục lỗi, mức tiêu chí, và lời nhắn cho từng
 * mã lỗi. Mọi mã lỗi đều có lời nhắn RIÊNG — hết ví token phải nói rõ chứ không thất bại lặng lẽ.
 */
export const CATEGORY_LABEL: Record<string, string> = {
  grammar: "Ngữ pháp",
  vocabulary: "Từ vựng",
  spelling: "Chính tả",
  word_order: "Trật tự từ",
  particle_or_measure: "Trợ từ / lượng từ",
  punctuation: "Dấu câu",
  cohesion: "Liên kết câu",
  register: "Văn phong",
  other: "Khác",
};

export const CRITERION_LABEL: Record<string, string> = {
  task: "Hoàn thành yêu cầu",
  grammar: "Ngữ pháp",
  vocabulary: "Từ vựng",
  coherence: "Mạch lạc",
  // LANG G7 — tiêu chí bài nói. "fluency" do HỆ THỐNG đo từ bản ghi (không phải mô hình đoán).
  language: "Từ vựng và ngữ pháp",
  fluency: "Lưu loát (đo từ bản ghi)",
};

export const LEVEL_LABEL: Record<string, { text: string; cls: string }> = {
  needs_work: { text: "Cần cải thiện", cls: "bg-amber-100 text-amber-800" },
  fair: { text: "Khá", cls: "bg-sky-100 text-sky-800" },
  good: { text: "Tốt", cls: "bg-emerald-100 text-emerald-800" },
};

export function describeWritingError(code: string | undefined): string {
  switch (code) {
    case "no_token_budget":
      return "Bạn đã dùng hết lượt AI của tháng này, nên chưa nhận được góp ý. Lượt AI sẽ được cấp lại đầu tháng sau, hoặc bạn có thể mua thêm.";
    case "global_token_cap":
    case "daily_token_cap":
      return "Hệ thống đang vượt hạn mức dùng AI hôm nay — thử lại sau.";
    case "rate_limited":
      return "Bài này đã được phân tích 3 lần trong 24 giờ qua. Hãy sửa bài rồi thử lại sau, hoặc nhờ giảng viên góp ý.";
    case "text_empty":
      return "Bài nộp đang trống — chưa có gì để góp ý.";
    case "text_too_long":
      return "Bài viết dài quá 5.000 từ nên chưa phân tích được. Hãy chia nhỏ bài viết.";
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
      return "AI xử lý không thành công. Lượt AI của bạn chưa bị trừ — hãy thử lại sau ít phút.";
    case "unauthorized":
      return "Phiên đăng nhập đã hết hạn — hãy tải lại trang.";
    default:
      return "Chưa nhận được góp ý. Vui lòng thử lại sau.";
  }
}
