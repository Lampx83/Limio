import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Reviewer's pending peer-review queue. */
export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const items = await prisma.missionReviewAssignment.findMany({
    where: { reviewerId: userId, completedAt: null },
    orderBy: { dueAt: "asc" },
    include: {
      submission: {
        include: {
          mission: {
            select: {
              id: true,
              title: true,
              tournament: { select: { id: true, title: true } },
            },
          },
        },
      },
    },
  });

  return NextResponse.json({
    items: items.map((ra) => ({
      id: ra.id,
      dueAt: ra.dueAt,
      missionId: ra.submission.mission.id,
      missionTitle: ra.submission.mission.title,
      tournamentId: ra.submission.mission.tournament.id,
      tournamentTitle: ra.submission.mission.tournament.title,
    })),
  });
}
