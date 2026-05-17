import { NextResponse } from "next/server";
import { logExamIncident } from "@feedbackme/core-lms";
import { requireExamSubject } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";
import { recordIncident } from "@/lib/exam-live-bus";

export const runtime = "nodejs";

/** A7.7.3 — Append an incident to the attempt log. Flag only, no auto-DQ. */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const subject = await requireExamSubject(params.id);
  if (!subject) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  try {
    const r = await logExamIncident(subject, params.id, body);
    if (body && typeof body === "object" && typeof (body as { type?: unknown }).type === "string") {
      await recordIncident(params.id, (body as { type: string }).type);
    }
    return NextResponse.json(r, { status: 201 });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
