import { NextResponse } from "next/server";
import { startExamAttempt } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";
import { upsertOnStart } from "@/lib/exam-live-bus";

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
    const a = await prisma.examAttempt.findUnique({
      where: { id: r.attemptId },
      select: {
        id: true,
        userId: true,
        status: true,
        startedAt: true,
        submittedAt: true,
        durationSec: true,
        resumeCount: true,
        user: { select: { displayName: true } },
        _count: { select: { incidents: true } },
        answers: { select: { questionId: true } },
      },
    });
    const totalQuestions = await prisma.examQuestion.count({
      where: { examId: params.id },
    });
    if (a) {
      await upsertOnStart(params.id, {
        attemptId: a.id,
        userId: a.userId,
        userName: a.user?.displayName ?? null,
        // startExamAttempt path is User-only (candidates go through
        // /api/public/exam/claim-code).
        subjectType: "user",
        status: a.status,
        startedAt: a.startedAt.getTime(),
        expiresAt: a.startedAt.getTime() + a.durationSec * 1000,
        submittedAt: a.submittedAt?.getTime() ?? null,
        answeredQuestionIds: a.answers.map((x) => x.questionId),
        totalQuestions,
        incidentCount: a._count.incidents,
        lastSeenAt: Date.now(),
        resumeCount: a.resumeCount,
      });
    }
    return NextResponse.json(r, { status: r.resumed ? 200 : 201 });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
