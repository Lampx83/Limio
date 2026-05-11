import { NextResponse } from "next/server";
import { saveAnswer } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** A7.4.4 — Autosave a single answer. Idempotent by answer hash. */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string; questionId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  try {
    const r = await saveAnswer(userId, params.id, params.questionId, body);
    return NextResponse.json(r);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
