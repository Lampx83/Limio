import { NextResponse } from "next/server";
import { deckAccessWhere } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireFeature } from "@/lib/session";

export const runtime = "nodejs";

/**
 * GET: số buổi dạy đã mở từng slide của bài giảng — { [slideId]: số buổi }. Dùng để cảnh báo khi
 * giảng viên sửa một slide tương tác đã có kết quả (H12). Chỉ chủ bài giảng.
 */
export async function GET(_req: Request, { params }: { params: { deckId: string } }) {
  const userId = await requireFeature("limio_live.access");
  if (!userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const deck = await prisma.liveDeck.findFirst({ where: { id: params.deckId, ...deckAccessWhere(userId) }, select: { id: true } });
  if (!deck) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const sessions = await prisma.liveSession.findMany({ where: { deckId: deck.id }, select: { slideRuntimeRefs: true } });
  const counts: Record<string, number> = {};
  for (const s of sessions) {
    for (const slideId of Object.keys((s.slideRuntimeRefs ?? {}) as Record<string, string>)) counts[slideId] = (counts[slideId] ?? 0) + 1;
  }
  return NextResponse.json({ sessions: counts });
}
