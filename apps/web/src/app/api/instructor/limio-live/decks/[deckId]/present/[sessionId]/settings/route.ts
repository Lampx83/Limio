import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireFeature } from "@/lib/session";
import { prisma } from "@feedbackme/db";
import { setLiveIdentityMode } from "@feedbackme/core-lms";

const Schema = z.object({ identityMode: z.enum(["anonymous", "login"]) });

/**
 * POST /api/instructor/limio-live/decks/[deckId]/present/[sessionId]/settings
 * Giảng viên đổi cách học viên vào phiên: ẩn danh hoặc bắt buộc đăng nhập.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { deckId: string; sessionId: string } }
) {
  try {
    const userId = await requireFeature("limio_live.access");
    if (!userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const parsed = Schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

    const session = await setLiveIdentityMode(params.sessionId, userId, parsed.data.identityMode, prisma);
    return NextResponse.json({ identityMode: session.identityMode });
  } catch (error) {
    console.error("[Limio-Live Present Settings API]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message.includes("Not authorized") ? 403 : 500 });
  }
}
