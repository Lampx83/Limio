import { NextResponse } from "next/server";
import { getFlashcardQueue } from "@feedbackme/core-feedback";
import { isFlashcardMode } from "@feedbackme/shared-types";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = { "cache-control": "private, no-store" };

/**
 * LANG G4 — GET /api/courses/:id/flashcards/queue?mode=
 * Phiên ôn của CHÍNH người đang đăng nhập (không nhận userId từ yêu cầu).
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: HEADERS });

  const mode = new URL(req.url).searchParams.get("mode") ?? "term_to_meaning";
  if (!isFlashcardMode(mode)) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400, headers: HEADERS });
  }

  const queue = await getFlashcardQueue(userId, params.id, { mode });
  if (queue.reason === "not_enrolled") {
    return NextResponse.json({ error: "not_enrolled" }, { status: 403, headers: HEADERS });
  }
  return NextResponse.json(queue, { headers: HEADERS });
}
