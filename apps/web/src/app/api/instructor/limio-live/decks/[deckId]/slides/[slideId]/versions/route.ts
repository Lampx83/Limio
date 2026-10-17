import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { listSlideVersions } from "@feedbackme/core-lms";
import { requireFeature } from "@/lib/session";

export const runtime = "nodejs";

/** GET: các phiên bản của một slide để hoàn tác (mới nhất trước). Chỉ chủ bài giảng. */
export async function GET(_req: Request, { params }: { params: { deckId: string; slideId: string } }) {
  const userId = await requireFeature("limio_live.access");
  if (!userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    const slide = await prisma.liveSlide.findFirst({ where: { id: params.slideId, deckId: params.deckId }, select: { id: true } });
    if (!slide) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const versions = await listSlideVersions(prisma, params.slideId, userId);
    return NextResponse.json({ versions });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message.includes("Not authorized") ? 403 : 500 });
  }
}
