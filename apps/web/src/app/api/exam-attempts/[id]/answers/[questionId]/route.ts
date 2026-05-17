import { NextResponse } from "next/server";
import { saveAnswer } from "@feedbackme/core-lms";
import { requireExamSubject } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";
import { recordAnswered } from "@/lib/exam-live-bus";

export const runtime = "nodejs";

/** A7.4.4 — Autosave a single answer. Idempotent by answer hash. */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string; questionId: string } },
) {
  const subject = await requireExamSubject(params.id);
  if (!subject) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  try {
    const r = await saveAnswer(subject, params.id, params.questionId, body);
    if (r.persisted) await recordAnswered(params.id, params.questionId);
    return NextResponse.json(r);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
