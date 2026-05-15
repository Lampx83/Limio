import { NextResponse } from "next/server";
import { reorderSessionRooms } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

// POST /api/exam-sessions/[id]/rooms/reorder
// Body: { orderedRoomIds: string[] } — array order = new STT order (1-based).
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as { orderedRoomIds?: unknown };
  const ids = Array.isArray(body?.orderedRoomIds)
    ? body.orderedRoomIds.filter((c): c is string => typeof c === "string")
    : [];
  try {
    await reorderSessionRooms(userId, params.id, ids);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
