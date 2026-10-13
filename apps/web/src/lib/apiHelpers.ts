import { NextResponse } from "next/server";
import {
  AccessCodeError,
  AnnotationError,
  AssignmentError,
  CourseAuthzError,
  CourseError,
  CourseTeamError,
  EnrollError,
  ExamError,
  LanguageTemplateError,
  LearningError,
  MisconceptionError,
  NoteError,
  PortfolioError,
  QuizError,
  SectionDeadlineError,
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
  if (err instanceof LanguageTemplateError) {
    return NextResponse.json(
      err.details ? { error: err.code, details: err.details } : { error: err.code },
      { status: err.code === "forbidden" ? 403 : 400 },
    );
  }
  if (err instanceof CourseError) {
    const status =
      err.code === "not_found" || err.code === "section_not_found"
        ? 404
        : err.code === "researcher_only"
          ? 403
          : err.code === "section_name_taken" || err.code === "section_has_enrollments"
            ? 409
            : 400;
    return NextResponse.json(
      err.details ? { error: err.code, details: err.details } : { error: err.code },
      { status },
    );
  }
  if (err instanceof SectionDeadlineError) {
    const status = err.code === "not_found" ? 404 : 400;
    return NextResponse.json(err.details ? { error: err.code, details: err.details } : { error: err.code }, { status });
  }
  if (err instanceof SkillError) {
    const status =
      err.code === "skill_not_found" ||
      err.code === "lesson_not_found" ||
      err.code === "tag_not_found"
        ? 404
        : err.code === "skill_code_taken"
          ? 409
          : err.code === "skill_in_use"
            ? 409
            : 400;
    return NextResponse.json(
      err.details ? { error: err.code, details: err.details } : { error: err.code },
      { status },
    );
  }
  if (err instanceof EnrollError) {
    const status =
      err.code === "course_not_found" || err.code === "invalid_invite_code"
        ? 404
        : err.code === "payment_required"
          ? 402
          : 400;
    return NextResponse.json({ error: err.code }, { status });
  }
  if (err instanceof AccessCodeError) {
    const status =
      err.code === "course_not_found" || err.code === "code_not_found"
        ? 404
        : err.code === "code_already_used" ||
            err.code === "course_not_enrollable" ||
            err.code === "course_invite_only"
          ? 409
          : err.code === "code_revoked"
            ? 410
            : 400;
    return NextResponse.json(
      err.details ? { error: err.code, details: err.details } : { error: err.code },
      { status },
    );
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
  if (err instanceof AnnotationError) {
    const status =
      err.code === "lesson_not_found" ||
      err.code === "annotation_not_found" ||
      err.code === "reply_not_found"
        ? 404
        : err.code === "not_enrolled"
          ? 403
          : err.code === "too_many"
            ? 429
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
              err.code === "quiz_past_due" ||
              err.code === "quiz_not_open" ||
              err.code === "attempt_already_submitted" ||
              err.code === "no_questions" ||
              err.code === "quiz_has_attempts"
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
      err.code === "answer_not_found" ||
      err.code === "message_not_found" ||
      err.code === "result_not_found" ||
      err.code === "candidate_not_found" ||
      err.code === "bank_not_found" ||
      err.code === "bank_question_not_found" ||
      err.code === "cohort_not_found" ||
      err.code === "schedule_not_found" ||
      err.code === "section_not_found" ||
      err.code === "practice_session_not_found" ||
      err.code === "round_not_found" ||
      err.code === "material_not_found" ||
      err.code === "topic_not_found"
        ? 404
        : err.code === "attempt_belongs_to_other" ||
            err.code === "not_enrolled" ||
            err.code === "audio_plays_exhausted" ||
            err.code === "practice_disabled" ||
            err.code === "forbidden"
          ? 403
          : err.code === "exam_has_attempts" ||
              err.code === "exam_not_draft" ||
              err.code === "exam_not_oral" ||
              err.code === "exam_not_written" ||
              err.code === "attempt_already_submitted" ||
              err.code === "attempt_limit_reached" ||
              err.code === "session_stale" ||
              err.code === "section_not_active" ||
              err.code === "mock_disabled" ||
              err.code === "practice_session_closed" ||
              err.code === "practice_check_disabled" ||
              err.code === "practice_not_answered" ||
              err.code === "exam_not_open" ||
              err.code === "exam_window_closed" ||
              err.code === "attempt_not_in_progress" ||
              err.code === "open_max_attempts_reached" ||
              err.code === "candidate_disabled" ||
              err.code === "access_mode_mismatch" ||
              err.code === "candidate_has_attempts" ||
              err.code === "session_has_attempts" ||
              err.code === "student_code_in_use" ||
              err.code === "cohort_has_attempts" ||
              err.code === "cohort_name_taken" ||
              err.code === "cohort_required"
            ? 409
            : err.code === "exam_not_publishable" ||
                err.code === "practice_scope_empty" ||
                err.code === "duration_extension_too_large" ||
                err.code === "bank_question_not_publishable" ||
                err.code === "bank_question_already_archived" ||
                err.code === "schedule_invalid_window" ||
                err.code === "section_pool_underfilled" ||
                err.code === "section_pool_empty" ||
                err.code === "round_invalid_window" ||
                err.code === "round_code_taken" ||
                err.code === "round_requires_at_least_one_course" ||
                err.code === "round_admin_already_exists" ||
                err.code === "round_course_already_added"
              ? 422
              : err.code === "invalid_code"
                ? 404
                : 400;
    return NextResponse.json(
      err.details ? { error: err.code, details: err.details } : { error: err.code },
      { status },
    );
  }
  if (err instanceof CourseTeamError) {
    const status =
      err.code === "course_not_found" || err.code === "team_not_found" || err.code === "join_code_invalid"
        ? 404
        : err.code === "not_enrolled" || err.code === "not_captain"
          ? 403
          : err.code === "already_in_team" ||
              err.code === "team_full" ||
              err.code === "team_name_taken" ||
              err.code === "teams_locked"
            ? 409
            : 400;
    return NextResponse.json(err.details ? { error: err.code, details: err.details } : { error: err.code }, { status });
  }
  if (err instanceof AssignmentError) {
    const status =
      err.code === "lesson_not_found" ||
      err.code === "assignment_not_found" ||
      err.code === "submission_not_found"
        ? 404
        : err.code === "not_enrolled" || err.code === "forbidden"
          ? 403
          : err.code === "no_team"
            ? 409
            : 400;
    return NextResponse.json(
      err.details ? { error: err.code, details: err.details } : { error: err.code },
      { status },
    );
  }
  if (err instanceof PortfolioError) {
    const status =
      err.code === "submission_not_found"
        ? 404
        : err.code === "slug_taken" || err.code === "group_full"
          ? 409
          : 400;
    return NextResponse.json({ error: err.code }, { status });
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
