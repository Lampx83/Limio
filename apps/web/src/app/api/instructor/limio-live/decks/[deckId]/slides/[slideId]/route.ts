import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/session";
import { prisma } from "@feedbackme/db";
import { updateLiveSlide, deleteLiveSlide } from "@feedbackme/core-lms";
import { validateContentSlideConfig } from "@/lib/limioLiveResource";
import { z } from "zod";

const UpdateSlideSchema = z.object({
  config: z.unknown().optional(),
  timerSeconds: z.number().int().positive().nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { deckId: string; slideId: string } }
) {
  try {
    const userId = await requireFeature("limio_live.access");
    if (!userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const validation = UpdateSlideSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    if (validation.data.config !== undefined) {
      const resourceError = validateContentSlideConfig(validation.data.config);
      if (resourceError) {
        return NextResponse.json({ error: resourceError.error }, { status: 400 });
      }
    }

    const slide = await updateLiveSlide(
      params.slideId,
      userId,
      validation.data,
      prisma
    );
    return NextResponse.json(slide);
  } catch (error) {
    console.error("[Limio-Live Slide API - PATCH]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Not authorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { deckId: string; slideId: string } }
) {
  try {
    const userId = await requireFeature("limio_live.access");
    if (!userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    await deleteLiveSlide(params.slideId, userId, prisma);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Limio-Live Slide API - DELETE]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Not authorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
