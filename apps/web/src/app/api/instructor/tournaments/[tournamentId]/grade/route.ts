import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { isAdmin } from "@feedbackme/core-lms";
import { gradeMissionSubmission, TournamentError } from "@feedbackme/core-gamification";
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

const Input = z.object({
  submissionId: z.string().min(1),
  passed: z.boolean(),
  // 0..1; optional — defaults to 1 (pass) / 0 (fail).
  score: z.number().min(0).max(1).optional(),
});

// POST — instructor manually grades a MANUAL_REVIEW mission submission.
export async function POST(
  req: Request,
  { params }: { params: { tournamentId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const denied = await authorize(params.tournamentId, userId);
  if (denied) return denied;

  const parsed = Input.safeParse(await readJson(req));
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
    const result = await gradeMissionSubmission(parsed.data.submissionId, {
      passed: parsed.data.passed,
      score: parsed.data.score,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof TournamentError) {
      const status =
        e.code === "submission_not_found"
          ? 404
          : e.code === "verify_mode_mismatch"
            ? 400
            : 400;
      return NextResponse.json({ error: e.code }, { status });
    }
    throw e;
  }
}
