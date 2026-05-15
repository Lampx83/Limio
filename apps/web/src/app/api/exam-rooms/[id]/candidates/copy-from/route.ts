import { NextResponse } from "next/server";
import { copyCandidatesFromRoom } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as { fromRoomId?: unknown };
  if (typeof body?.fromRoomId !== "string")
    return NextResponse.json(
      { error: "fromRoomId required" },
      { status: 400 },
    );
  try {
    const r = await copyCandidatesFromRoom(userId, params.id, body.fromRoomId);
    return NextResponse.json(r);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
