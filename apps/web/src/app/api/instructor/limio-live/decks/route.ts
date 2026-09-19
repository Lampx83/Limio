import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/session";
import { prisma } from "@feedbackme/db";
import { createLiveDeck, getUserLiveDecks } from "@feedbackme/core-lms";
import { z } from "zod";

const CreateDeckSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
});

/**
 * GET /api/instructor/limio-live/decks
 * List the current instructor's decks (personal library)
 */
export async function GET() {
  try {
    const userId = await requireFeature("limio_live.access");
    if (!userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const decks = await getUserLiveDecks(userId, prisma);
    return NextResponse.json({ decks });
  } catch (error) {
    console.error("[Limio-Live Decks API - GET]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/instructor/limio-live/decks
 * Create a new (empty) deck
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await requireFeature("limio_live.access");
    if (!userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const validation = CreateDeckSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const deck = await createLiveDeck(
      { userId, title: validation.data.title },
      prisma
    );

    return NextResponse.json(deck, { status: 201 });
  } catch (error) {
    console.error("[Limio-Live Decks API - POST]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
