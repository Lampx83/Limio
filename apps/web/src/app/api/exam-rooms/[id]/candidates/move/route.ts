import { NextResponse } from "next/server";
import { moveCandidatesToRoom } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

// POST /api/exam-rooms/[id]/candidates/move
// Body: { candidateIds: string[] }
// `id` = destination room.
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as { candidateIds?: unknown };
  const ids = Array.isArray(body?.candidateIds)
    ? body.candidateIds.filter((c): c is string => typeof c === "string")
    : [];
  if (ids.length === 0)
    return NextResponse.json(
      { error: "candidateIds required" },
      { status: 400 },
    );
  try {
    const r = await moveCandidatesToRoom(userId, params.id, ids);
    return NextResponse.json(r);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
