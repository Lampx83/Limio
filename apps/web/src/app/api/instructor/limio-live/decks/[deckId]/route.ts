import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/session";
import { prisma } from "@feedbackme/db";
import { getLiveDeck, updateLiveDeck, deleteLiveDeck } from "@feedbackme/core-lms";
import { z } from "zod";

const UpdateDeckSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
});

/**
 * GET /api/instructor/limio-live/decks/[deckId]
 * Get a deck with its ordered slides
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { deckId: string } }
) {
  try {
    const userId = await requireFeature("limio_live.access");
    if (!userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const deck = await getLiveDeck(params.deckId, userId, prisma);
    if (!deck) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json(deck);
  } catch (error) {
    console.error("[Limio-Live Deck API - GET]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { deckId: string } }
) {
  try {
    const userId = await requireFeature("limio_live.access");
    if (!userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const validation = UpdateDeckSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const deck = await updateLiveDeck(params.deckId, userId, validation.data, prisma);
    return NextResponse.json(deck);
  } catch (error) {
    console.error("[Limio-Live Deck API - PATCH]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Not authorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { deckId: string } }
) {
  try {
    const userId = await requireFeature("limio_live.access");
    if (!userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    await deleteLiveDeck(params.deckId, userId, prisma);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Limio-Live Deck API - DELETE]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Not authorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
