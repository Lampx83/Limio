import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

const Input = z.object({
  submissionId: z.string().uuid(),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Input.safeParse(await readJson(req));
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  // Verify submission belongs to a COLLECTIVE mission in this tournament.
  const submission = await prisma.missionSubmission.findUnique({
    where: { id: parsed.data.submissionId },
    select: {
      id: true,
      userId: true,
      mission: {
        select: { id: true, tournamentId: true, isTeamSubmission: true },
      },
    },
  });
  if (!submission || submission.mission.tournamentId !== params.id) {
    return NextResponse.json({ error: "submission_not_found" }, { status: 404 });
  }
  if (!submission.mission.isTeamSubmission) {
    return NextResponse.json(
      { error: "not_a_hackathon_mission" },
      { status: 400 },
    );
  }

  // Can't vote for own team's submission (submission.userId = captain of voter's team).
  const myReg = await prisma.tournamentRegistration.findUnique({
    where: { tournamentId_userId: { tournamentId: params.id, userId } },
    include: { team: { select: { captainId: true } } },
  });
  if (myReg?.team?.captainId === submission.userId) {
    return NextResponse.json({ error: "cannot_vote_own_team" }, { status: 400 });
  }

  // Upsert — voter can change vote, one per mission.
  await prisma.hackathonVote.upsert({
    where: {
      missionId_voterUserId: {
        missionId: submission.mission.id,
        voterUserId: userId,
      },
    },
    create: {
      missionId: submission.mission.id,
      voterUserId: userId,
      submissionId: submission.id,
    },
    update: { submissionId: submission.id },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const missionId = url.searchParams.get("missionId");
  if (!missionId) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  // Only allow delete on votes for missions in this tournament (defensive).
  const mission = await prisma.tournamentMission.findUnique({
    where: { id: missionId },
    select: { tournamentId: true },
  });
  if (!mission || mission.tournamentId !== params.id) {
    return NextResponse.json({ error: "mission_not_found" }, { status: 404 });
  }
  await prisma.hackathonVote.deleteMany({
    where: { missionId, voterUserId: userId },
  });
  return NextResponse.json({ ok: true });
}
