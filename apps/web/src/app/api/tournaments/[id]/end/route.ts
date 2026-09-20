import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { isAdmin } from "@feedbackme/core-lms";
import { endTournament } from "@feedbackme/core-gamification";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const tournament = await prisma.tournament.findUnique({
    where: { id: params.id },
    select: { id: true, creatorId: true, status: true },
  });

  if (!tournament) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const admin = await isAdmin(userId);
  if (!admin && tournament.creatorId !== userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (tournament.status !== "active" && tournament.status !== "published") {
    return NextResponse.json(
      {
        error: "validation_failed",
        details: "only_active_or_published_tournaments_can_be_ended",
      },
      { status: 400 },
    );
  }

  const result = await endTournament(params.id);

  return NextResponse.json({
    tournament: { id: params.id, status: result.status, endsAt: result.endsAt },
    prizesAwarded: result.prizesAwarded,
  });
}
