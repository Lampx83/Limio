import { NextResponse } from "next/server";
import { leaveTournament, TournamentError } from "@feedbackme/core-gamification";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await leaveTournament(userId, params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof TournamentError) {
      const status = e.code === "tournament_not_found" ? 404 : 400;
      return NextResponse.json({ error: e.code }, { status });
    }
    throw e;
  }
}
