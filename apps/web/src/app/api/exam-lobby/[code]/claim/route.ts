import { NextResponse } from "next/server";
import { claimByAccount, resolveLobbyTarget } from "@feedbackme/core-lms";
import { mapKnownError } from "@/lib/apiHelpers";
import { requireUserId } from "@/lib/session";
import { allow } from "@/lib/rate-limit";
import { leaveLobby } from "@/lib/exam-lobby-presence";
import { claimResponse } from "@/lib/exam-claim-response";

export const runtime = "nodejs";

/**
 * POST /api/exam-lobby/[code]/claim — vào thi bằng tài khoản đã đăng nhập (ca mã chung).
 * Đây là bước duy nhất tạo lượt làm và bắt đầu đếm giờ.
 */
export async function POST(_req: Request, { params }: { params: { code: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Chống bấm dồn: một tài khoản không tạo lượt quá nhiều lần trong một phút.
  const burst = await allow("claim:account", userId, 30, 60_000);
  if (!burst.ok)
    return NextResponse.json(
      { error: "rate_limited", retryAfter: burst.retryAfterSec },
      { status: 429, headers: { "retry-after": String(burst.retryAfterSec) } },
    );

  const target = await resolveLobbyTarget(params.code);
  try {
    const result = await claimByAccount(params.code, userId);
    if (target) await leaveLobby(target.sessionId, userId);
    return claimResponse(result, "open", userId);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
