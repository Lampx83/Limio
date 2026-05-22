import { NextResponse } from "next/server";
import { joinTeamByCode, TournamentError } from "@feedbackme/core-gamification";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { code?: string };
  if (!body.code) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  try {
    const res = await joinTeamByCode(userId, params.id, body.code);
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    if (e instanceof TournamentError) {
      const status =
        e.code === "tournament_not_found" || e.code === "team_join_code_invalid"
          ? 404
          : e.code === "already_registered" || e.code === "team_full"
            ? 409
            : 400;
      return NextResponse.json({ error: e.code }, { status });
    }
    throw e;
  }
}
