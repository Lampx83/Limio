import { NextResponse } from "next/server";
import {
  AssignmentError,
  CourseAuthzError,
  CourseError,
  EnrollError,
  ExamError,
  LearningError,
  MisconceptionError,
  NoteError,
  QuizError,
  SkillError,
} from "@feedbackme/core-lms";

/**
 * Map a known core-lms error to a NextResponse with appropriate status.
 * Returns null if not a known error — caller should rethrow.
 */
export function mapKnownError(err: unknown): NextResponse | null {
  if (err instanceof CourseAuthzError) {
    const status = err.code === "not_found" ? 404 : 403;
    return NextResponse.json({ error: err.code }, { status });
  }
  if (err instanceof CourseError) {
    const status = err.code === "not_found" ? 404 : 400;
    return NextResponse.json(
      err.details ? { error: err.code, details: err.details } : { error: err.code },
      { status },
    );
  }
  if (err instanceof SkillError) {
    const status =
      err.code === "skill_not_found" ||
      err.code === "lesson_not_found" ||
      err.code === "tag_not_found"
        ? 404
        : err.code === "skill_code_taken"
          ? 409
          : 400;
    return NextResponse.json(
      err.details ? { error: err.code, details: err.details } : { error: err.code },
      { status },
    );
  }
  if (err instanceof EnrollError) {
    const status =
      err.code === "course_not_found"
        ? 404
        : err.code === "payment_required"
          ? 402
          : 400;
    return NextResponse.json({ error: err.code }, { status });
  }
  if (err instanceof LearningError) {
    const status =
      err.code === "lesson_not_found"
        ? 404
        : err.code === "not_enrolled"
          ? 403
          : 400;
    return NextResponse.json(
      err.details ? { error: err.code, details: err.details } : { error: err.code },
      { status },
    );
  }
  if (err instanceof NoteError) {
    const status =
      err.code === "lesson_not_found" || err.code === "note_not_found"
        ? 404
        : err.code === "not_enrolled"
          ? 403
          : 400;
    return NextResponse.json(
      err.details ? { error: err.code, details: err.details } : { error: err.code },
      { status },
    );
  }
  if (err instanceof QuizError) {
    const status =
      err.code === "quiz_not_found" ||
      err.code === "question_not_found" ||
      err.code === "attempt_not_found"
        ? 404
        : err.code === "not_enrolled" || err.code === "attempt_belongs_to_other"
          ? 403
          : err.code === "max_attempts_exceeded" ||
              err.code === "attempt_already_submitted" ||
              err.code === "no_questions"
            ? 409
            : 400;
    return NextResponse.json(
      err.details ? { error: err.code, details: err.details } : { error: err.code },
      { status },
    );
  }
  if (err instanceof MisconceptionError) {
    const status = err.code === "code_taken" ? 409 : 400;
    return NextResponse.json({ error: err.code }, { status });
  }
  if (err instanceof ExamError) {
    const status =
      err.code === "exam_not_found" ||
      err.code === "attempt_not_found" ||
      err.code === "passage_not_found" ||
      err.code === "asset_not_found" ||
      err.code === "answer_not_found"
        ? 404
        : err.code === "attempt_belongs_to_other" || err.code === "not_enrolled"
          ? 403
          : err.code === "exam_has_attempts" ||
              err.code === "exam_not_draft" ||
              err.code === "attempt_already_submitted" ||
              err.code === "session_stale" ||
              err.code === "exam_not_open" ||
              err.code === "exam_window_closed"
            ? 409
            : err.code === "exam_not_publishable"
              ? 422
              : 400;
    return NextResponse.json(
      err.details ? { error: err.code, details: err.details } : { error: err.code },
      { status },
    );
  }
  if (err instanceof AssignmentError) {
    const status =
      err.code === "lesson_not_found" ||
      err.code === "assignment_not_found" ||
      err.code === "submission_not_found"
        ? 404
        : err.code === "not_enrolled" || err.code === "forbidden"
          ? 403
          : 400;
    return NextResponse.json(
      err.details ? { error: err.code, details: err.details } : { error: err.code },
      { status },
    );
  }
  return null;
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
