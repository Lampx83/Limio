import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/session";
import { prisma } from "@feedbackme/db";
import { addLiveSlide } from "@feedbackme/core-lms";
import { validateContentSlideConfig } from "@/lib/limioLiveResource";
import { z } from "zod";

const CreateSlideSchema = z.object({
  type: z.enum(["content", "quiz", "poll", "word_cloud", "collaborate_board", "whiteboard"]),
  config: z.unknown().default({}),
  timerSeconds: z.number().int().positive().nullable().optional(),
});

/**
 * POST /api/instructor/limio-live/decks/[deckId]/slides
 * Add a slide to a deck (appended at the end — real presentation order)
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

    const body = await req.json();
    const validation = CreateSlideSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    if (validation.data.type === "content") {
      const resourceError = validateContentSlideConfig(validation.data.config);
      if (resourceError) {
        return NextResponse.json({ error: resourceError.error }, { status: 400 });
      }
    }

    const slide = await addLiveSlide(
      params.deckId,
      userId,
      {
        type: validation.data.type,
        config: validation.data.config,
        timerSeconds: validation.data.timerSeconds,
      },
      prisma
    );
    return NextResponse.json(slide, { status: 201 });
  } catch (error) {
    console.error("[Limio-Live Slides API - POST]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Not authorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
