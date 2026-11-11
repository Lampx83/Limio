import { NextResponse } from "next/server";
import { AiGenerationError, AiTutorError, PracticeFeedbackError, type PracticeFeedbackBody } from "@feedbackme/core-feedback";

/**
 * Câu mở của Bài luyện: ánh xạ lỗi của lõi (`PracticeFeedbackError`, `AiTutorError`, thiếu cấu hình AI) sang HTTP và sang
 * mã ngắn cho giao diện. Một nơi duy nhất để route giọng nói và route kiểm tra nói cùng một thứ tiếng.
 */

const STATUS: Record<PracticeFeedbackError["code"], number> = {
  not_found: 404,
  forbidden: 403,
  not_essay: 400,
  feedback_disabled: 400,
  voice_disabled: 403,
  not_language_course: 400,
  control_group: 403,
  empty_answer: 422,
  audio_too_large: 413,
  audio_too_long: 422,
  no_speech: 422,
  stt_failed: 502,
  analysis_empty: 502,
};

/** Lỗi do thiếu cấu hình AI (không có khoá OpenAI, hoặc chưa đặt LLM tự host). */
export function isAiNotConfigured(e: unknown): boolean {
  return (e instanceof Error && e.message === "openai_not_configured") || (e instanceof AiTutorError && e.code === "no_api_key");
}

/** Ví token của học viên (hoặc trần hệ thống) đã hết. */
export function isAiQuota(e: unknown): boolean {
  return e instanceof AiTutorError && (e.code === "daily_token_cap" || e.code === "global_token_cap" || e.code === "no_token_budget" || e.code === "rate_limited");
}

/** Lỗi của route giọng nói → phản hồi; null nếu không phải lỗi thuộc nhóm này (để tầng gọi xử lý tiếp). */
export function mapPracticeAnswerError(e: unknown): NextResponse | null {
  if (isAiNotConfigured(e)) return NextResponse.json({ error: "openai_not_configured" }, { status: 503 });
  if (e instanceof PracticeFeedbackError) {
    return NextResponse.json(e.details ? { error: e.code, details: e.details } : { error: e.code }, { status: STATUS[e.code] ?? 400 });
  }
  if (e instanceof AiTutorError) {
    return NextResponse.json({ error: e.code, details: e.details }, { status: e.code === "openai_error" ? 502 : 429 });
  }
  if (e instanceof AiGenerationError) return NextResponse.json({ error: e.code }, { status: 502 });
  return null;
}

export type PracticeFeedbackErrorCode = "not_configured" | "quota" | "empty_answer" | "control_group" | "failed";

/**
 * Mã ngắn cho `feedbackError` của route kiểm tra. KHÔNG bao giờ ném: kiểm tra câu không được hỏng vì góp ý AI.
 * `feedback_disabled`/`not_language_course`/`not_essay` không đến đây (route đã lọc trước), nên rơi vào `failed` nếu lọt.
 */
export function feedbackErrorCode(e: unknown): PracticeFeedbackErrorCode {
  if (isAiNotConfigured(e)) return "not_configured";
  if (isAiQuota(e)) return "quota";
  if (e instanceof PracticeFeedbackError) {
    if (e.code === "empty_answer") return "empty_answer";
    if (e.code === "control_group") return "control_group";
  }
  return "failed";
}

/** Phần góp ý gửi cho trình duyệt: bỏ toạ độ SSMMD (`coding`) và số mục bị lọc (`dropped`), chỉ dùng nội bộ. */
export function publicFeedback(body: PracticeFeedbackBody): Omit<PracticeFeedbackBody, "coding" | "dropped"> {
  const { coding: _coding, dropped: _dropped, ...rest } = body;
  return rest;
}
