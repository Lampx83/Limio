import { NextResponse } from "next/server";
import { getAttemptRuntime } from "@feedbackme/core-lms";
import { requireExamSubject } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** A7.4.3 — Runtime payload (server clock + state for resume). */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const subject = await requireExamSubject(params.id);
  if (!subject) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const r = await getAttemptRuntime(subject, params.id);
    return NextResponse.json(r);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
