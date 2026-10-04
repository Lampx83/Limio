import { NextResponse } from "next/server";
import { AiGenerationError, AiTutorError, SpeakingFeedbackError } from "@feedbackme/core-feedback";

const STATUS: Record<string, number> = {
  submission_not_found: 404,
  feedback_not_found: 404,
  forbidden: 403,
  control_group: 403,
  not_language_course: 400,
  audio_missing: 422,
  audio_not_hosted: 422,
  audio_too_large: 413,
  audio_too_long: 422,
  no_speech: 422,
  stt_failed: 502,
  validation_failed: 400,
  rate_limited: 429,
  already_reviewed: 409,
  analysis_empty: 502,
};

/** Chuyển lỗi của G7 sang phản hồi HTTP; trả null nếu không phải lỗi của G7 (để tầng gọi xử lý tiếp). */
export function mapSpeakingError(e: unknown): NextResponse | null {
  if (e instanceof SpeakingFeedbackError) {
    return NextResponse.json(e.details ? { error: e.code, details: e.details } : { error: e.code }, { status: STATUS[e.code] ?? 400 });
  }
  if (e instanceof AiTutorError) return NextResponse.json({ error: e.code, details: e.details }, { status: 429 });
  if (e instanceof AiGenerationError) return NextResponse.json({ error: e.code }, { status: 502 });
  return null;
}
