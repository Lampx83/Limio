import { NextResponse } from "next/server";
import { markMessageRead } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** A5.3.5 — Student acks a message. Idempotent. */
export async function PATCH(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const r = await markMessageRead(userId, params.id);
    return NextResponse.json({ readAt: r.readAt });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
