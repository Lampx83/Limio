import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/session";
import { prisma } from "@feedbackme/db";
import { duplicateLiveDeck } from "@feedbackme/core-lms";

/**
 * POST /api/instructor/limio-live/decks/[deckId]/duplicate
 * Sao chép bài giảng (kèm toàn bộ slide) thành một bài mới của chính người gọi.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { deckId: string } }
) {
  try {
    const userId = await requireFeature("limio_live.access");
    if (!userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const deck = await duplicateLiveDeck(params.deckId, userId, prisma);
    return NextResponse.json(deck, { status: 201 });
  } catch (error) {
    console.error("[Limio-Live Deck API - duplicate]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.startsWith("Not authorized") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
