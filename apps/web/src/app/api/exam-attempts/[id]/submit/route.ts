import { NextResponse } from "next/server";
import { submitExamAttempt } from "@feedbackme/core-lms";
import { requireExamSubject } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";
import { recordStatus } from "@/lib/exam-live-bus";

export const runtime = "nodejs";

/** A7.5.1 — Manual submit. */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const subject = await requireExamSubject(params.id);
  if (!subject) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const r = await submitExamAttempt(subject, params.id);
    recordStatus(params.id, "submitted");
    return NextResponse.json(r);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
