export class QuizError extends Error {
  constructor(
    public readonly code:
      | "validation_failed"
      | "quiz_not_found"
      | "question_not_found"
      | "attempt_not_found"
      | "not_enrolled"
      | "max_attempts_exceeded"
      | "attempt_already_submitted"
      | "attempt_belongs_to_other"
      | "no_questions",
    public readonly details?: unknown,
  ) {
    super(code);
  }
}
