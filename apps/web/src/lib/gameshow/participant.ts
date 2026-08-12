import { prisma } from "@feedbackme/db";
import type { GameParticipant } from "@feedbackme/db";

/** Xác thực participant qua token bí mật (chống giả mạo tên/participantId lộ qua leaderboard). */
export async function verifyParticipant(
  sessionId: string,
  participantId: string,
  participantToken: string,
): Promise<GameParticipant | null> {
  if (!participantId || !participantToken) return null;
  const p = await prisma.gameParticipant.findUnique({ where: { id: participantId } });
  if (!p || p.sessionId !== sessionId || p.participantToken !== participantToken) return null;
  return p;
}
