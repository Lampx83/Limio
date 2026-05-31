import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { isAdmin } from "@feedbackme/core-lms";
import {
  assignReviewerManually,
  removeReviewerAssignment,
  CustomMissionError,
} from "@feedbackme/core-gamification";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Creator-or-admin guard for a tournament. Returns an error response or null. */
async function authorize(tournamentId: string, userId: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true, creatorId: true },
  });
  if (!tournament) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const admin = await isAdmin(userId);
  if (!admin && tournament.creatorId !== userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return null;
}

function errorStatus(code: CustomMissionError["code"]): number {
  switch (code) {
    case "submission_not_found":
    case "review_assignment_not_found":
      return 404;
    case "review_already_assigned":
      return 409;
    case "reviewer_is_author":
    case "verify_mode_mismatch":
    case "validation_failed":
      return 400;
    default:
      return 400;
  }
}

const PostInput = z.object({
  submissionId: z.string().min(1),
  reviewerId: z.string().min(1),
});

// POST — assign a reviewer to a submission by hand.
export async function POST(
  req: Request,
  { params }: { params: { tournamentId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const denied = await authorize(params.tournamentId, userId);
  if (denied) return denied;

  const parsed = PostInput.safeParse(await readJson(req));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Submission must belong to a mission in THIS tournament.
  const submission = await prisma.missionSubmission.findFirst({
    where: {
      id: parsed.data.submissionId,
      mission: { tournamentId: params.tournamentId },
    },
    select: { id: true },
  });
  if (!submission) {
    return NextResponse.json({ error: "submission_not_found" }, { status: 404 });
  }

  try {
    const result = await assignReviewerManually(parsed.data);
    return NextResponse.json({ ok: true, id: result.id });
  } catch (e) {
    if (e instanceof CustomMissionError) {
      return NextResponse.json(
        { error: e.code, ...(e.detail ? { detail: e.detail } : {}) },
        { status: errorStatus(e.code) },
      );
    }
    throw e;
  }
}

const DeleteInput = z.object({ assignmentId: z.string().min(1) });

// DELETE — remove a reviewer assignment (even if already reviewed; UI warns).
export async function DELETE(
  req: Request,
  { params }: { params: { tournamentId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const denied = await authorize(params.tournamentId, userId);
  if (denied) return denied;

  const parsed = DeleteInput.safeParse(await readJson(req));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Assignment must belong to a submission in THIS tournament.
  const ra = await prisma.missionReviewAssignment.findFirst({
    where: {
      id: parsed.data.assignmentId,
      submission: { mission: { tournamentId: params.tournamentId } },
    },
    select: { id: true },
  });
  if (!ra) {
    return NextResponse.json({ error: "review_assignment_not_found" }, { status: 404 });
  }

  try {
    const result = await removeReviewerAssignment(parsed.data);
    return NextResponse.json({ ok: true, wasCompleted: result.wasCompleted });
  } catch (e) {
    if (e instanceof CustomMissionError) {
      return NextResponse.json(
        { error: e.code, ...(e.detail ? { detail: e.detail } : {}) },
        { status: errorStatus(e.code) },
      );
    }
    throw e;
  }
}
