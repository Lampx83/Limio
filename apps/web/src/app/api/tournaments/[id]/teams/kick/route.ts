import { NextResponse } from "next/server";
import { kickFromTeam, TournamentError } from "@feedbackme/core-gamification";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { targetUserId?: string };
  if (!body.targetUserId) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  try {
    await kickFromTeam(userId, params.id, body.targetUserId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof TournamentError) {
      const status =
        e.code === "tournament_not_found" || e.code === "team_not_found"
          ? 404
          : e.code === "team_not_captain"
            ? 403
            : 400;
      return NextResponse.json({ error: e.code }, { status });
    }
    throw e;
  }
}
