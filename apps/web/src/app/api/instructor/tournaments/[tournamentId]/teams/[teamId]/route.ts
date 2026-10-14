import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { isAdmin } from "@feedbackme/core-lms";
import { renameTeamAsInstructor, TournamentError } from "@feedbackme/core-gamification";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Input = z.object({ name: z.string() });

// PATCH — giảng viên (người tạo giải hoặc admin) đổi tên một đội.
export async function PATCH(
  req: Request,
  { params }: { params: { tournamentId: string; teamId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const tournament = await prisma.tournament.findUnique({
    where: { id: params.tournamentId },
    select: { creatorId: true },
  });
  if (!tournament) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (tournament.creatorId !== userId && !(await isAdmin(userId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const parsed = Input.safeParse(await readJson(req));
  if (!parsed.success) return NextResponse.json({ error: "validation_failed" }, { status: 400 });

  try {
    const r = await renameTeamAsInstructor(userId, params.tournamentId, params.teamId, parsed.data.name);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    if (e instanceof TournamentError) {
      const status = e.code === "team_not_found" ? 404 : e.code === "team_name_taken" ? 409 : 400;
      return NextResponse.json({ error: e.code }, { status });
    }
    throw e;
  }
}
