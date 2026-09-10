import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";
import { requireHostSession } from "@/lib/gameshow/host";
import { removeParticipant } from "@/lib/gameshow/bus";

export const runtime = "nodejs";

// Host "đá" 1 học viên khỏi phòng chờ. Chỉ cho phép khi phòng còn "lobby" —
// giữa game thì participant vẫn cần tồn tại để giữ điểm những câu đã trả
// lời, xoá đi sẽ mồ côi GameAnswer và làm sai leaderboard.
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; participantId: string } },
) {
  const userId = await requireUserId();
  const check = await requireHostSession(params.id, userId);
  if (!check.ok) return Response.json({ error: check.error }, { status: check.status });

  if (check.session.status !== "lobby") {
    return Response.json({ error: "invalid_status" }, { status: 409 });
  }

  const participant = await prisma.gameParticipant.findUnique({
    where: { id: params.participantId },
  });
  if (!participant || participant.sessionId !== check.session.id) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.gameParticipant.delete({ where: { id: participant.id } });
  await removeParticipant(check.session.id, participant.id);

  return Response.json({ ok: true });
}
