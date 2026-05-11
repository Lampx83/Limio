import { NextResponse } from "next/server";
import { startExamAttempt } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** A7.4.1 / A7.4.5 — Start or resume an attempt. */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const r = await startExamAttempt(userId, params.id);
    return NextResponse.json(r, { status: r.resumed ? 200 : 201 });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
