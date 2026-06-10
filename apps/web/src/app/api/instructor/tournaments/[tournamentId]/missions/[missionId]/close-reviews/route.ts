import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { isAdmin } from "@feedbackme/core-lms";
import {
  closeReviewWindow,
  CustomMissionError,
} from "@feedbackme/core-gamification";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST — "Chốt điểm ngay" (GV/admin bấm tay trước hạn đóng vòng chấm).
 * force-close: tính median + chốt các bài đã ĐẠT quorum (reviewQuorum), BỎ QUA
 * bài chưa đủ (không gia hạn). Cron tự động tới reviewWindowEndAt vẫn chạy như cũ.
 */
export async function POST(
  _req: Request,
  { params }: { params: { tournamentId: string; missionId: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const mission = await prisma.tournamentMission.findFirst({
    where: { id: params.missionId, tournamentId: params.tournamentId },
    select: {
      id: true,
      verifyMode: true,
      tournament: { select: { creatorId: true } },
    },
  });
  if (!mission) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const admin = await isAdmin(userId);
  if (!admin && mission.tournament.creatorId !== userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (mission.verifyMode !== "PEER_REVIEW") {
    return NextResponse.json({ error: "verify_mode_mismatch" }, { status: 400 });
  }

  try {
    const r = await closeReviewWindow(params.missionId, undefined, {
      force: true,
    });
    return NextResponse.json({
      ok: true,
      closed: r.closed,
      skippedUnderQuorum: r.skippedUnderQuorum,
    });
  } catch (e) {
    if (e instanceof CustomMissionError) {
      return NextResponse.json({ error: e.code }, { status: 400 });
    }
    throw e;
  }
}
