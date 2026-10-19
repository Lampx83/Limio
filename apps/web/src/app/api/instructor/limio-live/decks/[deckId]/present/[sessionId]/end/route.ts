import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/session";
import { prisma } from "@feedbackme/db";
import { pauseLiveSession, resetLiveSession } from "@feedbackme/core-lms";

/**
 * POST /api/instructor/limio-live/decks/[deckId]/present/[sessionId]/end
 * Body { action }:
 *  - "leave" (mặc định): thoát màn chiếu, phiên tương tác (kết quả + mã) được giữ cho lần chiếu sau;
 *  - "save": lưu phiên vào lịch sử rồi bắt đầu phiên tương tác mới (kết quả trống, mã mới);
 *  - "discard": xoá kết quả phiên này rồi bắt đầu phiên tương tác mới.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { deckId: string; sessionId: string } }
) {
  try {
    const userId = await requireFeature("limio_live.access");
    if (!userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as { action?: string } | null;
    const action = body?.action ?? "leave";
    if (action !== "leave" && action !== "save" && action !== "discard") {
      return NextResponse.json({ error: "invalid_action" }, { status: 400 });
    }
    if (action === "leave") {
      await pauseLiveSession(params.sessionId, userId, prisma);
      return NextResponse.json({ ok: true });
    }
    const next = await resetLiveSession(params.sessionId, userId, action, prisma);
    return NextResponse.json({ ok: true, sessionId: next.id });
  } catch (error) {
    console.error("[Limio-Live Present End API]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Not authorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
