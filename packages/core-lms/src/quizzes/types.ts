export class QuizError extends Error {
  constructor(
    public readonly code:
      | "validation_failed"
      | "quiz_not_found"
      | "question_not_found"
      | "attempt_not_found"
      | "not_enrolled"
      | "max_attempts_exceeded"
      | "quiz_past_due"
      | "quiz_not_open"
      | "attempt_already_submitted"
      | "time_expired"
      | "attempt_belongs_to_other"
      | "no_questions"
      | "quiz_has_attempts"
      | "forbidden",
    public readonly details?: unknown,
  ) {
    super(code);
  }
}
