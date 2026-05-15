import { NextResponse } from "next/server";
import {
  claimByAssignedCode,
  claimByOpenCode,
  ExamError,
} from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { mapKnownError, readJson } from "@/lib/apiHelpers";
import { allow, clientIp } from "@/lib/rate-limit";
import {
  EXAM_SESSION_COOKIE,
  examSessionCookieOptions,
  signExamSession,
} from "@/lib/exam-session";
import { upsertOnStart } from "@/lib/exam-live-bus";

export const runtime = "nodejs";

/**
 * A5.8 — Public entry for code-based exam access.
 *
 * Body: { code, _hp?, displayName?, phone?, email?, studentCode?, class? }
 *   - `code` is auto-detected as open_code (6 chars) or assigned_code (8 chars).
 *   - Open mode requires { displayName, phone, email } in the same body.
 *   - Assigned mode ignores form fields (candidate already in DB).
 *   - `_hp` is the honeypot — bots fill, humans don't.
 *
 * On success: HttpOnly cookie `exam_session` is set; response carries the
 * attemptId so the client can redirect to /exam-take/[attemptId].
 *
 * Rate limits (Q2):
 *   - 50 claims / hour / IP for open mode (covers shared-IP labs)
 *   - 10 claims / minute / IP total (anti-brute-force on unknown codes)
 */
export async function POST(req: Request) {
  const ip = clientIp(req);

  // Burst guard first — same for both modes. Cheap.
  const burst = allow("claim:burst", ip, 10, 60_000);
  if (!burst.ok) {
    return NextResponse.json(
      { error: "rate_limited", retryAfter: burst.retryAfterSec },
      { status: 429, headers: { "retry-after": String(burst.retryAfterSec) } },
    );
  }

  const body = (await readJson(req)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  // Honeypot: humans never fill `_hp`. If present + truthy → drop silently with
  // 204 so bots don't get useful signal. Counter still ticks (already did).
  const hp = body._hp;
  if (typeof hp === "string" && hp.trim().length > 0) {
    return new NextResponse(null, { status: 204 });
  }

  const rawCode = body.code;
  if (typeof rawCode !== "string") {
    return NextResponse.json({ error: "invalid_code" }, { status: 404 });
  }
  const code = rawCode.trim().toUpperCase();

  // Auto-detect mode by length (matches generators in code-access.ts).
  // 6 = open, 8 = assigned. Anything else → invalid.
  let result;
  try {
    if (code.length === 6) {
      // Wider rate limit only on open-mode attempts (Q2: 50/h).
      const hourly = allow("claim:open", ip, 50, 60 * 60_000);
      if (!hourly.ok) {
        return NextResponse.json(
          { error: "rate_limited", retryAfter: hourly.retryAfterSec },
          {
            status: 429,
            headers: { "retry-after": String(hourly.retryAfterSec) },
          },
        );
      }
      result = await claimByOpenCode(code, body);
    } else if (code.length === 8) {
      result = await claimByAssignedCode(code);
    } else {
      throw new ExamError("invalid_code");
    }
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }

  // Push the new (or resumed) attempt onto the live bus so an open instructor
  // dashboard sees the candidate appear without needing to refresh.
  try {
    const totalQuestions = await prisma.examQuestion.count({
      where: { examId: result.examId },
    });
    const subjectType: "open" | "assigned" = code.length === 6 ? "open" : "assigned";
    upsertOnStart(result.examId, {
      attemptId: result.attemptId,
      userId: null,
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
