/**
 * Lỗi chung của nhánh AI. Tách khỏi aiTutor.ts để tokenWallet.ts dùng được mà
 * không tạo vòng import: aiTutor.ts gọi ví, ví cần ném lỗi này.
 */
export class AiTutorError extends Error {
  constructor(
    public readonly code:
      | "no_api_key"
      | "rate_limited"
      | "daily_token_cap"
      | "global_token_cap"
      | "no_token_budget"
      | "lesson_not_found"
      | "validation_failed"
      | "openai_error"
      // A6.2
      | "material_not_found",
    public readonly details?: unknown,
  ) {
    super(code);
  }
}
