export class ExamError extends Error {
  constructor(
    public readonly code:
      | "validation_failed"
      | "exam_not_found"
      | "exam_not_draft"
      | "exam_has_attempts"
      | "exam_not_publishable"
      | "course_mismatch"
      | "passage_not_found"
      | "asset_not_found"
      | "asset_not_image"
      | "alt_text_required"
      | "audio_policy_invalid"
      | "must_include_all_passages"
      | "unknown_passage"
      | "attempt_not_found"
      | "attempt_already_submitted"
      | "attempt_belongs_to_other"
      | "session_stale"
      | "not_enrolled"
      | "exam_not_open"
      | "exam_window_closed"
      | "question_not_in_exam"
      | "answer_not_found"
      | "score_out_of_range"
      | "not_manual_gradable",
    public readonly details?: unknown,
  ) {
    super(code);
  }
}
