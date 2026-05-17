import { NextResponse } from "next/server";
import { claimAttemptSession } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireExamSubject } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";
import { recordClaim } from "@/lib/exam-live-bus";

export const runtime = "nodejs";

/** A7.4.7 — Claim attempt session from a new tab (rotates sessionToken). */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const subject = await requireExamSubject(params.id);
  if (!subject) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const r = await claimAttemptSession(subject, params.id);
    const a = await prisma.examAttempt.findUnique({
      where: { id: params.id },
      select: { resumeCount: true },
    });
    if (a) await recordClaim(params.id, a.resumeCount);
    return NextResponse.json(r);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
