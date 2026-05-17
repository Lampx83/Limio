import { NextResponse } from "next/server";
import { resetAttemptSession } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";
import { recordClaim } from "@/lib/exam-live-bus";

export const runtime = "nodejs";

/** A5.3.5 — Instructor rotates session token; student must re-claim from new tab. */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const actorUserId = await requireUserId();
  if (!actorUserId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const r = await resetAttemptSession(actorUserId, params.id);
    await recordClaim(params.id, r.resumeCount);
    return NextResponse.json({ ok: true, resumeCount: r.resumeCount });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
