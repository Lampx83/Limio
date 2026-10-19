import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/session";
import { prisma } from "@feedbackme/db";
import { addLiveSlide, reorderLiveSlides } from "@feedbackme/core-lms";
import { moveIdTo } from "@/lib/limioLiveInsert";
import { validateContentSlideConfig } from "@/lib/limioLiveResource";
import { fillCoverIdentity, normalizeContentSlideConfig, resolveLayout } from "@/lib/limioLiveSlides";
import { coverIdentityFor } from "@/lib/limioLiveCoverIdentity";
import { z } from "zod";

const CreateSlideSchema = z.object({
  type: z.enum(["content", "quiz", "poll", "word_cloud", "collaborate_board", "whiteboard"]),
  config: z.unknown().default({}),
  timerSeconds: z.number().int().positive().nullable().optional(),
  /** Vị trí chèn (0 = đầu bài), từ nút [+] giữa các slide; bỏ trống = nối vào cuối. */
  insertAt: z.number().int().min(0).optional(),
});

/**
 * POST /api/instructor/limio-live/decks/[deckId]/slides
 * Add a slide to a deck (appended at the end — real presentation order). `insertAt` chèn vào vị trí đó (nút [+] giữa các slide).
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

    let config = validation.data.config;
    if (validation.data.type === "content") {
      config = normalizeContentSlideConfig(config);
      // Slide bìa mới: điền sẵn tên đơn vị và người trình bày vào ô còn trống.
      if (resolveLayout(config) === "cover") config = fillCoverIdentity(config as Record<string, unknown>, await coverIdentityFor(userId));
    }
    const slide = await addLiveSlide(
      params.deckId,
      userId,
      {
        type: validation.data.type,
        config,
        timerSeconds: validation.data.timerSeconds,
      },
      prisma
    );
    const at = validation.data.insertAt;
    if (at !== undefined) {
      const ids = (
        await prisma.liveSlide.findMany({ where: { deckId: params.deckId }, orderBy: { orderIndex: "asc" }, select: { id: true } })
      ).map((x) => x.id);
      const next = moveIdTo(ids, slide.id, at);
      if (next.some((id, i) => id !== ids[i])) await reorderLiveSlides(params.deckId, userId, next, prisma);
    }
    return NextResponse.json(slide, { status: 201 });
  } catch (error) {
    console.error("[Limio-Live Slides API - POST]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Not authorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
