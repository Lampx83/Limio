import { NextResponse } from "next/server";
import {
  claimByAssignedCode,
  claimByOpenCode,
  ExamError,
} from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { mapKnownError, readJson } from "@/lib/apiHelpers";
import { allow, clientIp, isBlocked } from "@/lib/rate-limit";
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
 * Body: { code, _hp?, displayName?, studentCode?, phone?, email?, class? }
 *   - `code` is auto-detected as open_code (6 chars) or assigned_code (8 chars).
 *   - Open mode requires { displayName, studentCode }; phone/email optional.
 *   - Assigned mode ignores form fields (candidate already in DB).
 *   - `_hp` is the honeypot — bots fill, humans don't.
 *
 * On success: HttpOnly cookie `exam_session` is set; response carries the
 * attemptId so the client can redirect to /exam-take/[attemptId].
 *
 * Rate limits — chống dò mã, nhưng KHÔNG được chặn cả phòng máy dùng chung một IP
 * (NAT): 60 sinh viên vào cùng lúc là chuyện bình thường, không phải tấn công.
 *   - đoán sai mã: 10 lần THẤT BẠI / phút / IP (chỉ tính lượt sai, lượt đúng không tốn)
 *   - lũ request: 300 / phút / IP (chặn flood, vẫn dư cho một phòng thi lớn)
 *   - mã thi mở: 500 lượt / giờ / (IP, mã) — nhân bản người thi đã được chặn ở
 *     tầng dữ liệu (một MSSV một bài), đây chỉ là van xả chống spam
 */
export async function POST(req: Request) {
  const ip = clientIp(req);
  // "unknown" = no trustworthy public IP in XFF/X-Real-IP. Skip throttling
  // rather than bucket every internal/gateway hop into one shared key, which
  // would lock out an entire classroom behind a misconfigured proxy. Honeypot
  // + code-validity still protect this endpoint.
  const throttle = ip !== "unknown";

  // Hàng rào chống dò mã: đã sai quá nhiều lần thì chặn TRƯỚC khi xử lý, kẻ dò
  // mã không được biết lượt kế tiếp có đúng hay không.
  if (throttle) {
    const failures = await isBlocked("claim:invalid", ip, 10, 60_000);
    if (!failures.ok) {
      return NextResponse.json(
        { error: "rate_limited", retryAfter: failures.retryAfterSec },
        { status: 429, headers: { "retry-after": String(failures.retryAfterSec) } },
      );
    }
    const burst = await allow("claim:burst", ip, 300, 60_000);
    if (!burst.ok) {
      return NextResponse.json(
        { error: "rate_limited", retryAfter: burst.retryAfterSec },
        { status: 429, headers: { "retry-after": String(burst.retryAfterSec) } },
      );
    }
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
      // Van xả riêng cho mã thi mở (theo IP + mã, xem chú thích đầu file).
      if (throttle) {
        const hourly = await allow("claim:open", `${ip}:${code}`, 500, 60 * 60_000);
        if (!hourly.ok) {
          return NextResponse.json(
            { error: "rate_limited", retryAfter: hourly.retryAfterSec },
            {
              status: 429,
              headers: { "retry-after": String(hourly.retryAfterSec) },
            },
          );
        }
      }
      result = await claimByOpenCode(code, body);
    } else if (code.length === 8) {
      result = await claimByAssignedCode(code);
    } else {
      throw new ExamError("invalid_code");
    }
  } catch (e) {
    // Ghi nhận lượt sai vào hàng rào chống dò (xem đầu hàm): đoán mã, và đoán
    // email/SĐT để chiếm lại một bài đang làm (student_code_in_use).
    if (
      throttle &&
      e instanceof ExamError &&
      (e.code === "invalid_code" || e.code === "student_code_in_use")
    ) {
      await allow("claim:invalid", ip, 10, 60_000);
    }
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
    await upsertOnStart(result.examId, {
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
