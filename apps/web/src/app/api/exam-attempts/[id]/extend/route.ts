import { NextResponse } from "next/server";
import { extendAttempt } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";
import { recordExtended } from "@/lib/exam-live-bus";

export const runtime = "nodejs";

/** A5.3.5 — Instructor extends remaining time on an in-progress attempt. */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const actorUserId = await requireUserId();
  if (!actorUserId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  const minutes = Number((body as { minutes?: unknown })?.minutes);
  try {
    const r = await extendAttempt(actorUserId, params.id, minutes);
    await recordExtended(params.id, r.newDurationSec, r.newDeadline.getTime());
    return NextResponse.json(r);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
