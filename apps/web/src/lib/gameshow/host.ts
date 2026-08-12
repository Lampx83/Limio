import { prisma } from "@feedbackme/db";
import type { GameSession } from "@feedbackme/db";

export type HostCheckResult =
  | { ok: true; session: GameSession }
  | { ok: false; status: 401 | 403 | 404; error: string };

/** Load a GameSession and verify `userId` is its host. */
export async function requireHostSession(
  sessionId: string,
  userId: string | null,
): Promise<HostCheckResult> {
  if (!userId) return { ok: false, status: 401, error: "unauthorized" };
  const gameSession = await prisma.gameSession.findUnique({ where: { id: sessionId } });
  if (!gameSession) return { ok: false, status: 404, error: "not_found" };
  if (gameSession.hostId !== userId) return { ok: false, status: 403, error: "forbidden" };
  return { ok: true, session: gameSession };
}
