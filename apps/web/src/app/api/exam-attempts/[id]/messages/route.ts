import { NextResponse } from "next/server";
import {
  listMessagesForAttempt,
  sendMessageToAttempt,
} from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";
import { recordMessageSent } from "@/lib/exam-live-bus";

export const runtime = "nodejs";

/** A5.3.5 — Student polls direct + broadcast messages for an attempt. */
export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sinceParam = new URL(req.url).searchParams.get("since");
  const since = sinceParam ? Number(sinceParam) : undefined;
  try {
    const messages = await listMessagesForAttempt(
      userId,
      params.id,
      Number.isFinite(since) ? since : undefined,
    );
    return NextResponse.json({ messages });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}

/** A5.3.5 — Instructor sends a direct message to one attempt. */
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
    const r = await sendMessageToAttempt(actorUserId, params.id, text);
    recordMessageSent(params.id, r.id, typeof text === "string" ? text : "");
    return NextResponse.json(r, { status: 201 });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
