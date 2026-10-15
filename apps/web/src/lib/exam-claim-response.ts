import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import type { ClaimResult } from "@feedbackme/core-lms";
import { EXAM_SESSION_COOKIE, examSessionCookieOptions, signExamSession } from "./exam-session";
import { upsertOnStart } from "./exam-live-bus";

/**
 * Trả về sau khi vào thi thành công: đẩy lượt làm lên bus trực tiếp (để màn
 * giám sát thấy ngay) và đặt cookie exam_session. Dùng chung cho mọi đường
 * claim (mã chung, mã cá nhân, tài khoản) để cookie và bus luôn giống nhau.
 */
export async function claimResponse(
  result: ClaimResult,
  subjectType: "open" | "assigned",
  userId: string | null = null,
): Promise<NextResponse> {
  // Push the new (or resumed) attempt onto the live bus so an open instructor
  // dashboard sees the candidate appear without needing to refresh.
  try {
    const totalQuestions = await prisma.examQuestion.count({
      where: { examId: result.examId },
    });
    await upsertOnStart(result.examId, {
      attemptId: result.attemptId,
      userId,
      userName: result.displayName,
      subjectType,
      status: "in_progress",
      startedAt: Date.now(),
      expiresAt: Date.now() + result.ttlSec * 1000,
      submittedAt: null,
      answeredQuestionIds: [],
      totalQuestions,
      incidentCount: 0,
      lastSeenAt: Date.now(),
      resumeCount: 0,
    });
  } catch {
    // Best-effort. Bus push must not break the claim.
  }

  // Issue exam_session cookie (HS256 JWT) and return the attemptId so the
  // client redirects to /exam-take/[attemptId]. Cookie TTL matches the claim
  // result's ttlSec, capped to exam-window + grace.
  const jwt = signExamSession({
    candidateId: result.candidateId,
    attemptId: result.attemptId,
    examId: result.examId,
    sessionToken: result.sessionToken,
    exp: Math.floor(Date.now() / 1000) + result.ttlSec,
  });
  const opts = examSessionCookieOptions(result.ttlSec);
  const res = NextResponse.json({
    attemptId: result.attemptId,
    examId: result.examId,
    displayName: result.displayName,
    resumed: result.resumed,
  });
  res.cookies.set(EXAM_SESSION_COOKIE, jwt, {
    httpOnly: opts.httpOnly,
    secure: opts.secure,
    sameSite: opts.sameSite,
    path: opts.path,
    maxAge: opts.maxAge,
  });
  return res;
}
