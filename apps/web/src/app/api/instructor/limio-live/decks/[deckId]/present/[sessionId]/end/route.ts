import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/session";
import { prisma } from "@feedbackme/db";
import { endLiveSession } from "@feedbackme/core-lms";

/**
 * POST /api/instructor/limio-live/decks/[deckId]/present/[sessionId]/end
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

    await endLiveSession(params.sessionId, userId, prisma);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Limio-Live Present End API]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Not authorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
