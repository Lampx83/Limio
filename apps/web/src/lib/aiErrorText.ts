/**
 * Câu tiếng Việt cho mã lỗi của lời gọi AI chấm/gợi ý điểm — để giao diện không hiện mã thô ("Gợi ý lỗi: no_token_budget").
 * Trả null với mã lạ để tầng gọi tự quyết định thông báo chung.
 */
export function aiSuggestErrorText(code: string): string | null {
  switch (code) {
    case "no_token_budget":
      return "Ví token AI của tài khoản này đã hết cho tháng này. Bạn vẫn có thể nhập điểm và chốt điểm bằng tay.";
    case "global_token_cap":
    case "daily_token_cap":
      return "Hệ thống đang vượt hạn mức dùng AI hôm nay — thử lại sau.";
    case "rate_limited":
      return "AI đang bị giới hạn lượt gọi — thử lại sau ít phút.";
    case "openai_not_configured":
      return "Chưa cấu hình AI. Vào Admin → Tích hợp để thêm khoá.";
    default:
      return null;
  }
}
