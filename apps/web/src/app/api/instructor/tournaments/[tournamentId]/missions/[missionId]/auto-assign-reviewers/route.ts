import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { isAdmin } from "@feedbackme/core-lms";
import {
  assignPeerReviewers,
  gateAutoAssignReviewers,
  CustomMissionError,
} from "@feedbackme/core-gamification";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorStatus(code: CustomMissionError["code"]): number {
  switch (code) {
    case "submission_not_found":
      return 404;
    case "verify_mode_mismatch":
    case "validation_failed":
      return 400;
    default:
      return 400;
  }
}

/**
 * POST — instructor/admin bấm tay để phân reviewer cho TOÀN BỘ submission của
 * một mission PEER_REVIEW cùng lúc (thay vì thêm từng người qua dropdown).
 *
 * Tái dùng nguyên `assignPeerReviewers` của core (idempotent): chỉ BÙ cho đủ
 * `peerReviewerCount`, không đụng reviewer đã phân tay. Mọi lượt phân vẫn emit
 * `TournamentMissionReviewAssigned` để audit (§5 event-sourcing).
 *
 * Guard thời điểm: chỉ cho bấm sau khi `submissionDeadline` trôi qua — khớp với
 * điều kiện cron `tournamentTick` (pool reviewer = người đã nộp bài).
 */
export async function POST(
  req: Request,
  { params }: { params: { tournamentId: string; missionId: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Optional body: { rebalance?: boolean }. rebalance = xóa phân chưa chấm rồi
  // chia đều lại; mặc định topup = chỉ bù cho đủ.
  const body = (await req
    .json()
    .catch(() => ({}))) as { rebalance?: boolean };
  const mode = body?.rebalance === true ? "rebalance" : "topup";

  // Mission phải thuộc tournament này; lấy luôn creatorId + field cần guard.
  const mission = await prisma.tournamentMission.findFirst({
    where: { id: params.missionId, tournamentId: params.tournamentId },
    select: {
      id: true,
      verifyMode: true,
      submissionDeadline: true,
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

  // Business rule (mode + hạn nộp) sống ở core; route chỉ map sang HTTP status.
  const gate = gateAutoAssignReviewers({
    verifyMode: mission.verifyMode,
    submissionDeadline: mission.submissionDeadline,
    now: new Date(),
  });
  if (!gate.allowed) {
    return NextResponse.json(
      { error: gate.reason },
      { status: gate.reason === "verify_mode_mismatch" ? 400 : 409 },
    );
  }

  try {
    const { assignedCount, unassignedCount } = await assignPeerReviewers(
      params.missionId,
      undefined,
      { mode },
    );
    return NextResponse.json({ ok: true, assignedCount, unassignedCount });
  } catch (e) {
    if (e instanceof CustomMissionError) {
      return NextResponse.json(
        { error: e.code, ...(e.detail ? { detail: e.detail } : {}) },
        { status: errorStatus(e.code) },
      );
    }
    throw e;
  }
}
