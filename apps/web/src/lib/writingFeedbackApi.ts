import { NextResponse } from "next/server";
import { AiGenerationError, AiTutorError, WritingFeedbackError } from "@feedbackme/core-feedback";

const STATUS: Record<string, number> = {
  submission_not_found: 404,
  feedback_not_found: 404,
  forbidden: 403,
  control_group: 403,
  not_language_course: 400,
  text_empty: 422,
  text_too_long: 422,
  validation_failed: 400,
  rate_limited: 429,
  already_reviewed: 409,
  analysis_empty: 502,
};

/** Chuyển lỗi của G6 sang phản hồi HTTP; trả null nếu không phải lỗi của G6 (để tầng gọi xử lý tiếp). */
export function mapWritingError(e: unknown): NextResponse | null {
  if (e instanceof WritingFeedbackError) {
    return NextResponse.json(e.details ? { error: e.code, details: e.details } : { error: e.code }, { status: STATUS[e.code] ?? 400 });
  }
  if (e instanceof AiTutorError) {
    // Hết ví/hạn mức: 429 như các nhánh AI khác; giao diện đọc `error` để nói rõ (không thất bại lặng lẽ).
    return NextResponse.json({ error: e.code, details: e.details }, { status: 429 });
  }
  if (e instanceof AiGenerationError) {
    return NextResponse.json({ error: e.code }, { status: 502 });
  }
  return null;
}
