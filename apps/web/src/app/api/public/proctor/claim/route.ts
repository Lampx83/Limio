import { NextResponse } from "next/server";
import { claimProctorCode, ExamError } from "@feedbackme/core-lms";
import { mapKnownError, readJson } from "@/lib/apiHelpers";
import { allow, clientIp } from "@/lib/rate-limit";
import {
  proctorCookieOptions,
  PROCTOR_SESSION_TTL_SEC,
  signProctorSession,
} from "@/lib/proctor-session";

export const runtime = "nodejs";

/**
 * Giám thị đổi mã lấy phiên. Body: { code }.
 *
 * Siết chặt hơn cửa thí sinh: mã này mở ra danh sách người thật và tiến độ làm
 * bài của họ, nên dò trúng đắt hơn nhiều. 5 lần/phút thay vì 10.
 */
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (ip !== "unknown") {
    const burst = await allow("proctor:claim", ip, 5, 60_000);
    if (!burst.ok) {
      return NextResponse.json(
        { error: "rate_limited", retryAfter: burst.retryAfterSec },
        { status: 429, headers: { "retry-after": String(burst.retryAfterSec) } },
      );
    }
  }

  const body = (await readJson(req)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "validation_failed" }, { status: 400 });

  try {
    const claim = await claimProctorCode(body.code);
    const res = NextResponse.json({ ok: true, roomName: claim.roomName });
    res.cookies.set({
      ...proctorCookieOptions(PROCTOR_SESSION_TTL_SEC),
      value: signProctorSession({
        roomId: claim.roomId,
        sessionId: claim.sessionId,
        examId: claim.examId,
        exp: Math.floor(Date.now() / 1000) + PROCTOR_SESSION_TTL_SEC,
      }),
    });
    return res;
  } catch (e) {
    // mapKnownError trả null cho lỗi nó không nhận ra — ném tiếp để thành 500
    // thật, đừng nuốt thành response rỗng.
    const mapped = e instanceof ExamError ? mapKnownError(e) : null;
    if (mapped) return mapped;
    throw e;
  }
}
