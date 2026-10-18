import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireFeature } from "@/lib/session";
import { prisma } from "@feedbackme/db";
import { setLiveDeckSharing } from "@feedbackme/core-lms";

const ShareSchema = z.object({ action: z.enum(["enable", "rotate", "disable"]) });

/**
 * POST /api/instructor/limio-live/decks/[deckId]/share  { action: "enable" | "rotate" | "disable" }
 * Bật / tạo link mới / tắt link xem chỉ đọc /bai-giang/<mã> — chỉ chủ bài. Trả { shareCode } (null khi tắt).
 */
export async function POST(req: NextRequest, { params }: { params: { deckId: string } }) {
  try {
    const userId = await requireFeature("limio_live.access");
    if (!userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const parsed = ShareSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

    const result = await setLiveDeckSharing(params.deckId, userId, parsed.data.action, prisma);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Limio-Live Deck API - share]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    // Không phải chủ bài: trả 404 như bài không tồn tại, không để lộ là bài có thật.
    const status = message.startsWith("Not authorized") ? 404 : 500;
    return NextResponse.json({ error: status === 404 ? "not_found" : message }, { status });
  }
}
