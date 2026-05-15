import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { assertCanEditCourse, computeExamAnalytics, computeBankAnalytics } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** Manual analytics trigger for a single exam. Instructor-only. */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const exam = await prisma.exam.findUnique({
    where: { id: params.id },
    select: { id: true, courseId: true },
  });
  if (!exam)
    return NextResponse.json({ error: "exam_not_found" }, { status: 404 });

  try {
    await assertCanEditCourse(userId, exam.courseId);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }

  const t0 = Date.now();
  const { questionsScanned, statsWritten } = await computeExamAnalytics(exam.id);
  // Also refresh bank-level aggregates so BankWorkbench quality dots update.
  await computeBankAnalytics();

  return NextResponse.json({
    ok: true,
    questionsScanned,
    statsWritten,
    durationMs: Date.now() - t0,
  });
}
