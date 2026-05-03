import { NextResponse } from "next/server";
import {
  completeMission,
  TournamentError,
} from "@feedbackme/core-gamification";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const r = await completeMission(userId, params.id);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    if (e instanceof TournamentError) {
      const status =
        e.code === "mission_not_found"
          ? 404
          : e.code === "not_registered" || e.code === "prereq_not_completed"
            ? 403
            : 400;
      return NextResponse.json({ error: e.code }, { status });
    }
    throw e;
  }
}
