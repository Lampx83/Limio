import { NextResponse } from "next/server";
import { redeemAccessCode } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";
import { allow, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Đổi mã kích hoạt lấy một chỗ trong khoá. Body: { code }.
 *
 * Mã tự nó cấp quyền vào khoá (không ai xác minh lại như AiTokenOrder), nên
 * đây là bề mặt duy nhất có thể bị dò mã hàng loạt — rate-limit theo cả IP
 * lẫn người dùng, vì một tài khoản dò nhiều mã khác nhau cũng đáng ngờ như
 * một IP dò từ nhiều tài khoản.
 */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const ip = clientIp(req);
  if (ip !== "unknown") {
    const ipLimit = await allow("redeem-code:ip", ip, 20, 10 * 60_000);
    if (!ipLimit.ok) {
      return NextResponse.json(
        { error: "rate_limited", retryAfter: ipLimit.retryAfterSec },
        { status: 429, headers: { "retry-after": String(ipLimit.retryAfterSec) } },
      );
    }
  }
  const userLimit = await allow("redeem-code:user", userId, 10, 10 * 60_000);
  if (!userLimit.ok) {
    return NextResponse.json(
      { error: "rate_limited", retryAfter: userLimit.retryAfterSec },
      { status: 429, headers: { "retry-after": String(userLimit.retryAfterSec) } },
    );
  }

  const body = (await readJson(req)) as { code?: string } | null;
  if (!body?.code?.trim()) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  const origin = new URL(req.url).origin;
  try {
    const result = await redeemAccessCode(userId, body.code, undefined, {
      baseUrl: origin,
    });
    return NextResponse.json(result);
  } catch (e) {
    return mapKnownError(e) ?? (() => { throw e; })();
  }
}
