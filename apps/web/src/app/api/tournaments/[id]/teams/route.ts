import { NextResponse } from "next/server";
import { createTeam, TournamentError } from "@feedbackme/core-gamification";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { name?: string };
  if (!body.name) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  try {
    const res = await createTeam(userId, params.id, body.name);
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    if (e instanceof TournamentError) {
      const status =
        e.code === "tournament_not_found"
          ? 404
          : e.code === "already_registered" || e.code === "team_name_taken"
            ? 409
            : 400;
      return NextResponse.json({ error: e.code }, { status });
    }
    throw e;
  }
}
