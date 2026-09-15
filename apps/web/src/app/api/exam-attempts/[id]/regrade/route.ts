import { NextResponse } from "next/server";
import {
  applyAutoGradingForAttempt,
  canEditExam,
  ExamError,
} from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Instructor escape-hatch: re-grade a single ExamAttempt synchronously
 * (does NOT use BullMQ). For attempts stuck in `submitted` / `auto_submitted`
 * with score=null because the auto-grade worker was unavailable.
 *
 * Idempotent — if attempt is already graded, returns existing score.
 * Authz: any instructor who can edit the exam's course.
 */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const attempt = await prisma.examAttempt.findUnique({
    where: { id: params.id },
    select: { exam: { select: { courseId: true, createdById: true } } },
  });
  if (!attempt)
    return NextResponse.json({ error: "attempt_not_found" }, { status: 404 });
  if (!(await canEditExam(userId, attempt.exam)))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    const r = await applyAutoGradingForAttempt(params.id);
    return NextResponse.json({
      ok: true,
      score: r.autoScore,
      fullyGraded: r.fullyGraded,
      status: r.status,
    });
  } catch (e) {
    if (e instanceof ExamError) {
      return NextResponse.json(
        { error: e.code, details: e.details },
        { status: 400 },
      );
    }
    throw e;
  }
}
