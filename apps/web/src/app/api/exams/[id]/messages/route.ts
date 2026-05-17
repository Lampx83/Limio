import { NextResponse } from "next/server";
import { broadcastMessageToExam } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";
import { recordMessageBroadcast } from "@/lib/exam-live-bus";

export const runtime = "nodejs";

/** A5.3.5 — Instructor broadcasts a message to every in-progress attempt. */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const actorUserId = await requireUserId();
  if (!actorUserId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  const text = (body as { body?: unknown })?.body;
  try {
    const r = await broadcastMessageToExam(actorUserId, params.id, text);
    await recordMessageBroadcast(params.id, r.id, typeof text === "string" ? text : "");
    return NextResponse.json(r, { status: 201 });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
