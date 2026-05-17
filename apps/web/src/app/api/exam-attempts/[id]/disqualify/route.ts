import { NextResponse } from "next/server";
import { disqualifyAttempt } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";
import { recordStatus } from "@/lib/exam-live-bus";

export const runtime = "nodejs";

/** A5.3.5 — Instructor flags an attempt (status=flagged). No auto-zero. */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const actorUserId = await requireUserId();
  if (!actorUserId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  const reason = (body as { reason?: unknown })?.reason;
  try {
    const r = await disqualifyAttempt(actorUserId, params.id, reason);
    await recordStatus(params.id, r.status);
    return NextResponse.json(r);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
