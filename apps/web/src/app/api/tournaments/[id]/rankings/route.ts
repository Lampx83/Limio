import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOP_N = 50;

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!tournament) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const rankings = await prisma.tournamentRanking.findMany({
    where: { tournamentId: params.id },
    orderBy: { rank: "asc" },
    take: TOP_N,
    select: {
      rank: true,
      totalPoints: true,
      userId: true,
      teamId: true,
    },
  });

  // Collect unique userIds that are set
  const userIds = rankings.map((r) => r.userId).filter((id): id is string => id !== null);

  // Batch-fetch user name/image for all ranked users in one query
  const users =
    userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, displayName: true, avatarUrl: true },
        })
      : [];

  const userMap = new Map(users.map((u) => [u.id, u]));

  const result = rankings.map((r) => ({
    rank: r.rank,
    totalPoints: r.totalPoints,
    ...(r.userId !== null && { userId: r.userId }),
    ...(r.teamId !== null && { teamId: r.teamId }),
    ...(r.userId !== null && userMap.has(r.userId)
      ? {
          user: {
            name: userMap.get(r.userId)!.displayName,
            image: userMap.get(r.userId)!.avatarUrl,
          },
        }
      : {}),
  }));

  return NextResponse.json({ rankings: result });
}
