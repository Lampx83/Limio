import { NextResponse } from "next/server";
import { setCandidateAttendance } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

// PATCH /api/exam-rooms/[id]/candidates/[candidateId]/attendance
// Body: { present: boolean }
// Authz: proctor of room OR edit-round
export async function PATCH(
  req: Request,
  { params }: { params: { id: string; candidateId: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as { present?: unknown };
  if (typeof body?.present !== "boolean")
    return NextResponse.json(
      { error: "present (boolean) required" },
      { status: 400 },
    );
  try {
    const r = await setCandidateAttendance(
      userId,
      params.candidateId,
      body.present,
    );
    return NextResponse.json(r);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
