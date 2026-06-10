import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { isAdmin } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RubricCriterion = {
  id: string;
  label: string;
  scale: "1-5" | "pass_fail";
  weight: number;
};
type ScoreEntry = { criterionId: string; score: number };

/**
 * GET — chi tiết chấm peer review của 1 submission cho GV (creator/admin):
 * từng reviewer kèm điểm rubric, nhận xét, điểm tổng hợp, lệch median, cờ outlier.
 * Read-only. Dữ liệu nhạy cảm → bắt buộc authz (§4 privacy).
 */
export async function GET(
  _req: Request,
  {
    params,
  }: { params: { tournamentId: string; submissionId: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Submission phải thuộc 1 mission của tournament này; lấy kèm rubric + creator.
  const submission = await prisma.missionSubmission.findFirst({
    where: {
      id: params.submissionId,
      mission: { tournamentId: params.tournamentId },
    },
    select: {
      id: true,
      status: true,
      finalScore: true,
      mission: {
        select: {
          rubric: true,
          peerReviewerCount: true,
          reviewQuorum: true,
          tournament: { select: { creatorId: true } },
        },
      },
      reviewAssignments: {
        orderBy: [{ completedAt: "asc" }],
        select: {
          id: true,
          completedAt: true,
          scores: true,
          comment: true,
          aggregateScore: true,
          deltaFromMedian: true,
          flagged: true,
          flagReason: true,
          xpAwarded: true,
          reviewer: { select: { displayName: true } },
        },
      },
    },
  });
  if (!submission) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const admin = await isAdmin(userId);
  if (!admin && submission.mission.tournament.creatorId !== userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const rubric = (submission.mission.rubric as RubricCriterion[] | null) ?? [];

  const reviews = submission.reviewAssignments.map((ra) => ({
    reviewerName: ra.reviewer.displayName,
    completed: ra.completedAt !== null,
    scores: (ra.scores as ScoreEntry[] | null) ?? [],
    comment: ra.comment,
    aggregateScore: ra.aggregateScore,
    deltaFromMedian: ra.deltaFromMedian,
    flagged: ra.flagged,
    flagReason: ra.flagReason,
    xpAwarded: ra.xpAwarded,
  }));

  return NextResponse.json({
    status: submission.status,
    finalScore: submission.finalScore,
    peerReviewerCount: submission.mission.peerReviewerCount,
    reviewQuorum: submission.mission.reviewQuorum,
    rubric: rubric.map((c) => ({ id: c.id, label: c.label, scale: c.scale })),
    reviews,
  });
}
