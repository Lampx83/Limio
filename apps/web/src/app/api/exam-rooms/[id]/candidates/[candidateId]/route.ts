import { NextResponse } from "next/server";
import { removeCandidateFromRoom } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; candidateId: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await removeCandidateFromRoom(userId, params.candidateId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
