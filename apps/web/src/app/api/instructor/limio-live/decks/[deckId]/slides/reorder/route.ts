import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/session";
import { prisma } from "@feedbackme/db";
import { reorderLiveSlides } from "@feedbackme/core-lms";
import { z } from "zod";

const ReorderSchema = z.object({
  orderedSlideIds: z.array(z.string()).min(1),
});

/**
 * POST /api/instructor/limio-live/decks/[deckId]/slides/reorder
 * This IS the presentation order (unlike Kịch bản lớp học's reorder, which is
 * display-only).
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
    const validation = ReorderSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    await reorderLiveSlides(
      params.deckId,
      userId,
      validation.data.orderedSlideIds,
      prisma
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Limio-Live Slides Reorder API]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Not authorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
