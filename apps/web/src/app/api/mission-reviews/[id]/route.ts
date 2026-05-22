import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { submitPeerReview, CustomMissionError } from "@feedbackme/core-gamification";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET — reviewer fetches a single review assignment + rubric + anonymized
// submission payload.
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const ra = await prisma.missionReviewAssignment.findUnique({
    where: { id: params.id },
    include: {
      submission: {
        include: { mission: { select: { title: true, description: true, rubric: true, passThreshold: true } } },
      },
    },
  });
  if (!ra) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (ra.reviewerId !== userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return NextResponse.json({
    id: ra.id,
    dueAt: ra.dueAt,
    completedAt: ra.completedAt,
    mission: ra.submission.mission,
    // Submitter identity withheld — peer review is double-blind.
    submissionPayload: ra.submission.payload,
    scores: ra.scores,
    comment: ra.comment,
  });
}

const PostInput = z.object({
  scores: z.array(
    z.object({
      criterionId: z.string().min(1),
      score: z.number(),
    }),
  ).min(1),
  comment: z.string().max(5_000).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await readJson(req);
  const parsed = PostInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  try {
    await submitPeerReview({
      reviewAssignmentId: params.id,
      reviewerId: userId,
      scores: parsed.data.scores,
      comment: parsed.data.comment,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof CustomMissionError) {
      const status =
        e.code === "review_not_assigned"
          ? 403
          : e.code === "already_reviewed"
            ? 409
            : 400;
      return NextResponse.json(
        { error: e.code, ...(e.detail ? { detail: e.detail } : {}) },
        { status },
      );
    }
    throw e;
  }
}
