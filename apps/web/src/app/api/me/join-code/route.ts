import { NextResponse } from "next/server";
import { LearningEventType } from "@feedbackme/shared-types";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";
import { allow, clientIp } from "@/lib/rate-limit";
import { resolutionKind, resolveJoinCode } from "@/lib/joinCode";
import { emitLiveEvent } from "@/lib/limioLiveEvents";

export const runtime = "nodejs";

/**
 * POST /api/me/join-code — ô "Nhập mã" trên trang Bắt đầu (docs/hoc-vien/trang-dau-hoc-vien-AC.md, AC2).
 * Body: { code }. Trả loại mã + đích chuyển tới, kèm tên khi phải chọn — không trả gì nội bộ của lớp/đề/phiên.
 *
 * Tra được mọi bảng mã nên đây là chỗ dò mã hàng loạt — giới hạn như /api/redeem-code, theo cả IP lẫn tài khoản.
 */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const ip = clientIp(req);
  if (ip !== "unknown") {
    const ipLimit = await allow("join-code:ip", ip, 20, 10 * 60_000);
    if (!ipLimit.ok) return rateLimited(ipLimit.retryAfterSec);
  }
  const userLimit = await allow("join-code:user", userId, 10, 10 * 60_000);
  if (!userLimit.ok) return rateLimited(userLimit.retryAfterSec);

  const body = (await readJson(req)) as { code?: unknown } | null;
  if (typeof body?.code !== "string" || !body.code.trim() || body.code.length > 64) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  const { code, resolution } = await resolveJoinCode(body.code);
  // Ghi sự kiện không chặn câu trả lời; emitLiveEvent tự nuốt lỗi.
  void emitLiveEvent(userId, LearningEventType.OnboardingCodeSubmitted, { length: code.length, ...resolutionKind(resolution) });
  return NextResponse.json(resolution);
}

function rateLimited(retryAfter: number) {
  return NextResponse.json(
    { error: "rate_limited", retryAfter },
    { status: 429, headers: { "retry-after": String(retryAfter) } },
  );
}
