/**
 * A5.8 Q6 — Candidate looks up their own result by re-entering the code each
 * time (no cookie-based public URL). 2 paths:
 *
 *   - assigned_code: code = candidate.accessCode → unique candidate → result.
 *   - open_code:     code = ExamSession.openCode (PR2.12, mã theo CA — đường
 *                    Link thi nhanh dùng đường này) với Exam.openCode (mã cũ
 *                    theo ĐỀ) là fallback cho dữ liệu từ trước PR2.12 → nhiều
 *                    thí sinh cùng mã → cần thêm `identifier` (email HOẶC mã
 *                    sinh viên từ metadata lúc claim) để xác định đúng người.
 *
 * Returns a sanitised view: score (only when showScore) + per-question
 * correctness (only when showDetail) — chính sách của CA THI quyết định từng
 * cái độc lập, xem reveal-policy.ts. Never leaks other candidates' data.
 */

import { prisma, type PrismaClient } from "@feedbackme/db";
import { ExamError } from "./types";
import {
  canRevealAnswers,
  canRevealScore,
  REVEAL_SESSION_SELECT,
} from "./reveal-policy";

export interface CandidateResult {
  examTitle: string;
  candidateName: string;
  status: "submitted" | "auto_submitted" | "graded" | "flagged";
  submittedAt: string | null;
  // null khi !showScore — không chỉ ẩn ở UI, mà ẩn ngay từ payload trả về.
  score: number | null;
  scorePct: number | null;
  totalPoints: number;
  fullyGraded: boolean;
  // Điểm cuối cùng (không kèm đáp án) xem được chưa — chính sách `score_only`
  // và `immediately` bật cờ này mà không bật showDetail.
  showScore: boolean;
  showDetail: boolean;
  // When showDetail is true: 1 entry per question this candidate answered.
  details?: { prompt: string; correct: boolean | null; points: number; awarded: number | null }[];
}

export async function lookupCandidateResult(
  rawCode: unknown,
  /** Email HOẶC mã sinh viên — cả hai đều tuỳ chọn lúc claim (xem code-access.ts),
   * nên thử khớp cả hai thay vì chỉ email. */
  rawIdentifier: unknown,
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
    // Open mode — openCode alone is ambiguous; require an identifier from
    // claim metadata (email HOẶC mã sinh viên — cả hai tuỳ chọn lúc claim,
    // xem code-access.ts) để phân biệt đúng người.
    if (typeof rawIdentifier !== "string" || rawIdentifier.trim().length === 0)
      throw new ExamError("candidate_email_required");
    const identifierRaw = rawIdentifier.trim();
    const identifierEmail = identifierRaw.toLowerCase();

    // PR2.12 — mã theo CA (ExamSession.openCode) trước; Exam.openCode là mã
    // cũ theo ĐỀ, chỉ còn cho dữ liệu từ trước PR2.12. Thiếu nhánh session ở
    // đây thì MỌI buổi mở qua "Link thi nhanh" (shareExamLink) đều báo
    // invalid_code — session không set Exam.openCode.
    const sessionMatch = await db.examSession.findFirst({
      where: { openCode: code, accessMode: "open_code" },
      select: {
        id: true,
        exam: {
          select: { id: true, title: true, showResultsAfterSubmit: true, accessMode: true },
        },
      },
    });
    let e: { id: string; title: string; showResultsAfterSubmit: boolean } | null = null;
    let sessionId: string | null = null;
    if (sessionMatch) {
      e = sessionMatch.exam;
      sessionId = sessionMatch.id;
    } else {
      const legacy = await db.exam.findUnique({
        where: { openCode: code },
        select: { id: true, title: true, showResultsAfterSubmit: true, accessMode: true },
      });
      if (legacy && legacy.accessMode === "open_code") e = legacy;
    }
    if (!e) throw new ExamError("invalid_code");

    // Khớp theo email HOẶC mã sinh viên — metadata.email/studentCode. Scope
    // thêm theo sessionId khi biết (mã theo CA): cùng đề mở nhiều ca, ca sau
    // không được lẫn thí sinh của ca trước dù trùng email/MSSV.
    const cand = await db.examCandidate.findFirst({
      where: {
        examId: e.id,
        ...(sessionId ? { sessionId } : {}),
        OR: [
          { metadata: { path: ["email"], equals: identifierEmail } },
          { metadata: { path: ["studentCode"], equals: identifierRaw } },
        ],
      },
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
      session: { select: REVEAL_SESSION_SELECT },
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
  // Chính sách của CA THI, không phải của gói đề. Xem reveal-policy.ts.
  const showScore =
    fullyGraded && canRevealScore(attempt.session, exam!, new Date());
  const showDetail =
    fullyGraded && canRevealAnswers(attempt.session, exam!, new Date());
  const totalPoints = attempt.answers.reduce((s, a) => s + a.question.points, 0);
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
    score: showScore ? attempt.score : null,
    scorePct: showScore ? attempt.scorePct : null,
    totalPoints,
    fullyGraded,
    showScore,
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
      candidateDisplayName: true,
      candidate: { select: { displayName: true } },
      exam: { select: { title: true, showResultsAfterSubmit: true } },
      session: { select: REVEAL_SESSION_SELECT },
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
  const showScore =
    fullyGraded && canRevealScore(attempt.session, attempt.exam, new Date());
  const showDetail =
    fullyGraded && canRevealAnswers(attempt.session, attempt.exam, new Date());
  const totalPoints = attempt.answers.reduce((s, a) => s + a.question.points, 0);
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
    score: showScore ? attempt.score : null,
    scorePct: showScore ? attempt.scorePct : null,
    totalPoints,
    fullyGraded,
    showScore,
    showDetail,
    details,
  };
}
