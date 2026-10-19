import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { restoreSlideVersion } from "@feedbackme/core-lms";
import { requireFeature } from "@/lib/session";
import { emitLiveEvent, LearningEventType } from "@/lib/limioLiveEvents";

export const runtime = "nodejs";

/**
 * POST: khôi phục slide về một phiên bản (H11). Trạng thái hiện tại được chụp trước nên khôi phục
 * cũng hoàn tác được. Trả slide sau khi khôi phục.
 */
export async function POST(_req: Request, { params }: { params: { deckId: string; slideId: string; versionId: string } }) {
  const userId = await requireFeature("limio_live.access");
  if (!userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    const owned = await prisma.liveSlide.findFirst({ where: { id: params.slideId, deckId: params.deckId }, select: { id: true } });
    if (!owned) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const version = await prisma.liveSlideVersion.findFirst({ where: { id: params.versionId, slideId: params.slideId }, select: { source: true } });
    const slide = await restoreSlideVersion(prisma, params.slideId, params.versionId, userId);
    await emitLiveEvent(userId, LearningEventType.LiveSlideVersionRestored, {
      deckId: params.deckId,
      slideId: params.slideId,
      versionId: params.versionId,
      versionSource: version?.source ?? "unknown",
    });
    return NextResponse.json(slide);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = message.includes("Not authorized") ? 403 : message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
