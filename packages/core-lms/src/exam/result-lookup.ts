/**
 * A5.8 Q6 — Candidate looks up their own result by re-entering the code each
 * time (no cookie-based public URL). 2 paths:
 *
 *   - assigned_code: code = candidate.accessCode → unique candidate → result.
 *   - open_code:     code = Exam.openCode → many candidates → also require
 *                    `email` from claim metadata to identify the specific row.
 *
 * Returns a sanitised view: scores + per-question correctness (only when
 * `exam.showResultsAfterSubmit=true`). Never leaks other candidates' data.
 */

import { prisma, type PrismaClient } from "@feedbackme/db";
import { ExamError } from "./types";

export interface CandidateResult {
  examTitle: string;
  candidateName: string;
  status: "submitted" | "auto_submitted" | "graded" | "flagged";
  submittedAt: string | null;
  score: number | null;
  scorePct: number | null;
  passed: boolean | null;
  fullyGraded: boolean;
  showDetail: boolean;
  // When showDetail is true: 1 entry per question this candidate answered.
  details?: { prompt: string; correct: boolean | null; points: number; awarded: number | null }[];
}

export async function lookupCandidateResult(
  rawCode: unknown,
  rawEmail: unknown,
  db: PrismaClient = prisma,
): Promise<CandidateResult> {
  if (typeof rawCode !== "string" || rawCode.trim().length === 0)
    throw new ExamError("invalid_code");
  const code = rawCode.trim().toUpperCase();

  let attemptId: string | null = null;
  let exam: {
    id: string;
    title: string;
    showResultsAfterSubmit: boolean;
  } | null = null;
  let candidateName: string | null = null;

  if (code.length === 8) {
    // Assigned mode — accessCode → 1 candidate → at most 1 attempt.
    const cand = await db.examCandidate.findFirst({
      where: { accessCode: code },
      select: {
        id: true,
        displayName: true,
        exam: {
          select: { id: true, title: true, showResultsAfterSubmit: true, accessMode: true },
        },
        attempts: {
          select: { id: true },
          orderBy: { startedAt: "desc" },
          take: 1,
        },
      },
    });
    if (!cand || cand.exam.accessMode !== "assigned_code")
      throw new ExamError("invalid_code");
    if (cand.attempts.length === 0) throw new ExamError("result_not_found");
    exam = cand.exam;
    candidateName = cand.displayName;
    attemptId = cand.attempts[0]!.id;
  } else if (code.length === 6) {
    // Open mode — openCode alone is ambiguous; require email from metadata
    // to disambiguate. Email is mandatory at claim (Q1), so this works.
    if (typeof rawEmail !== "string" || rawEmail.trim().length === 0)
      throw new ExamError("candidate_email_required");
    const email = rawEmail.trim().toLowerCase();
    const e = await db.exam.findUnique({
      where: { openCode: code },
      select: { id: true, title: true, showResultsAfterSubmit: true, accessMode: true },
    });
    if (!e || e.accessMode !== "open_code")
      throw new ExamError("invalid_code");

    // Find candidate by metadata.email. JSON path filter in Postgres.
    const cand = await db.examCandidate.findFirst({
      where: { examId: e.id, metadata: { path: ["email"], equals: email } },
      select: {
        id: true,
        displayName: true,
        attempts: {
          select: { id: true },
          orderBy: { startedAt: "desc" },
          take: 1,
        },
      },
    });
    if (!cand) throw new ExamError("result_not_found");
    if (cand.attempts.length === 0) throw new ExamError("result_not_found");
    exam = e;
    candidateName = cand.displayName;
    attemptId = cand.attempts[0]!.id;
  } else {
    throw new ExamError("invalid_code");
  }

  const attempt = await db.examAttempt.findUnique({
    where: { id: attemptId! },
    select: {
      status: true,
      submittedAt: true,
      score: true,
      scorePct: true,
      passed: true,
      answers: {
        select: {
          questionId: true,
          autoScore: true,
          manualScore: true,
          needsGrading: true,
          question: { select: { prompt: true, points: true } },
        },
      },
    },
  });
  if (!attempt) throw new ExamError("result_not_found");
  // Any non-terminal status (in_progress, submitted, auto_submitted) means the
  // worker hasn't produced a score yet — surface as pending so the candidate
  // page shows the auto-refresh view rather than collapsing into the generic
  // "instructor disabled details" branch.
  if (
    attempt.status === "in_progress" ||
    attempt.status === "submitted" ||
    attempt.status === "auto_submitted"
  )
    throw new ExamError("result_not_yet_graded");

  const fullyGraded = attempt.status === "graded";
  const showDetail = exam!.showResultsAfterSubmit && fullyGraded;
  const details = showDetail
    ? attempt.answers.map((a) => {
        const awarded = a.manualScore ?? a.autoScore;
        return {
          prompt: a.question.prompt.slice(0, 200),
          points: a.question.points,
          awarded,
          correct: awarded === null ? null : awarded >= a.question.points,
        };
      })
    : undefined;

  return {
    examTitle: exam!.title,
    candidateName: candidateName!,
    status: attempt.status as CandidateResult["status"],
    submittedAt: attempt.submittedAt?.toISOString() ?? null,
    score: attempt.score,
    scorePct: attempt.scorePct,
    passed: attempt.passed,
    fullyGraded,
    showDetail,
    details,
  };
}

/**
 * Variant: lookup by attemptId. Used by the post-submit confirmation page
 * (/exam-take/[attemptId]/submitted) where the candidate cookie is still
 * valid so we already know the attempt — no need to re-enter code/email.
 *
 * Caller MUST authorize the subject (requireExamSubject) before calling.
 * This function does no additional access check beyond loading the row.
 *
 * Mirrors lookupCandidateResult's return shape so the same UI can render both.
 */
export async function getCandidateResultByAttemptId(
  attemptId: string,
  db: PrismaClient = prisma,
): Promise<CandidateResult> {
  const attempt = await db.examAttempt.findUnique({
    where: { id: attemptId },
    select: {
      status: true,
      submittedAt: true,
      score: true,
      scorePct: true,
      passed: true,
      candidateDisplayName: true,
      candidate: { select: { displayName: true } },
      exam: { select: { title: true, showResultsAfterSubmit: true } },
      answers: {
        select: {
          questionId: true,
          autoScore: true,
          manualScore: true,
          needsGrading: true,
          question: { select: { prompt: true, points: true } },
        },
      },
    },
  });
  if (!attempt) throw new ExamError("result_not_found");
  if (attempt.status === "in_progress")
    throw new ExamError("result_not_yet_graded");

  const fullyGraded = attempt.status === "graded";
  const showDetail = attempt.exam.showResultsAfterSubmit && fullyGraded;
  const details = showDetail
    ? attempt.answers.map((a) => {
        const awarded = a.manualScore ?? a.autoScore;
        return {
          prompt: a.question.prompt.slice(0, 200),
          points: a.question.points,
          awarded,
          correct: awarded === null ? null : awarded >= a.question.points,
        };
      })
    : undefined;

  return {
    examTitle: attempt.exam.title,
    candidateName:
      attempt.candidate?.displayName ?? attempt.candidateDisplayName ?? "Thí sinh",
    status: attempt.status as CandidateResult["status"],
    submittedAt: attempt.submittedAt?.toISOString() ?? null,
    score: attempt.score,
    scorePct: attempt.scorePct,
    passed: attempt.passed,
    fullyGraded,
    showDetail,
    details,
  };
}
