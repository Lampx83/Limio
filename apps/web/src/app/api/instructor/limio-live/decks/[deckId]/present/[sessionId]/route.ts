import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/session";
import { prisma } from "@feedbackme/db";
import { getOwnedSession } from "@feedbackme/core-lms";
import { describeRuntime, type Runtime } from "@/lib/limioLiveRuntime";

/**
 * GET /api/instructor/limio-live/decks/[deckId]/present/[sessionId]
 * Read-only mirror of the present run, polled by the audience window
 * (see PresentDeck.tsx) — never mutates state, unlike the slides/[slideId]
 * POST route the presenter window drives.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { deckId: string; sessionId: string } }
) {
  try {
    const userId = await requireFeature("limio_live.access");
    if (!userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const session = await getOwnedSession(params.sessionId, userId, prisma);
    if (session.deckId !== params.deckId) {
      return NextResponse.json({ error: "session_deck_mismatch" }, { status: 400 });
    }

    let runtime: Runtime | null = null;
    if (session.currentSlideId) {
      const slide = await prisma.liveSlide.findUnique({ where: { id: session.currentSlideId } });
      if (slide) {
        if (slide.type === "content") {
          runtime = { kind: "content" };
        } else {
          const refId = (session.slideRuntimeRefs as Record<string, string>)[slide.id];
          if (refId) runtime = await describeRuntime(slide.type, refId);
        }
      }
    }

    return NextResponse.json({
      currentSlideId: session.currentSlideId,
      endedAt: session.endedAt,
      uiState: session.uiState,
      runtime,
    });
  } catch (error) {
    console.error("[Limio-Live Present Session API]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Not authorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
