import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/session";
import { prisma } from "@feedbackme/db";
import { patchSessionUiState } from "@feedbackme/core-lms";

/**
 * POST /api/instructor/limio-live/decks/[deckId]/present/[sessionId]/ui-state
 * Presenter-only: merge a patch into LiveSession.uiState (timer start times,
 * quiz reveal flags) so the audience window's polling GET picks it up.
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

    const body = await req.json().catch(() => null);
    if (!body || typeof body.patch !== "object" || body.patch === null) {
      return NextResponse.json({ error: "invalid_patch" }, { status: 400 });
    }

    const session = await patchSessionUiState(params.sessionId, userId, body.patch, prisma);
    if (session.deckId !== params.deckId) {
      return NextResponse.json({ error: "session_deck_mismatch" }, { status: 400 });
    }

    return NextResponse.json({ uiState: session.uiState });
  } catch (error) {
    console.error("[Limio-Live Present UI State API]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Not authorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
