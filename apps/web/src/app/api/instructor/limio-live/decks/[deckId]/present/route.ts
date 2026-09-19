import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/session";
import { prisma } from "@feedbackme/db";
import { startOrResumeLiveSession } from "@feedbackme/core-lms";

/**
 * POST /api/instructor/limio-live/decks/[deckId]/present
 * Start presenting this deck — resumes the caller's still-open run if any.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { deckId: string } }
) {
  try {
    const userId = await requireFeature("limio_live.access");
    if (!userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const session = await startOrResumeLiveSession(params.deckId, userId, prisma);
    return NextResponse.json(session);
  } catch (error) {
    console.error("[Limio-Live Present API - POST]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Not authorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
