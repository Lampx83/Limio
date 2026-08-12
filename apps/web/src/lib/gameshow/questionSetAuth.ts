import { prisma } from "@feedbackme/db";
import type { GameQuestionSet } from "@feedbackme/db";

export type SetOwnerCheck =
  | { ok: true; set: GameQuestionSet }
  | { ok: false; status: 401 | 403 | 404; error: string };

/** Load a GameQuestionSet and verify `userId` owns it. */
export async function requireQuestionSetOwner(
  setId: string,
  userId: string | null,
): Promise<SetOwnerCheck> {
  if (!userId) return { ok: false, status: 401, error: "unauthorized" };
  const set = await prisma.gameQuestionSet.findUnique({ where: { id: setId } });
  if (!set) return { ok: false, status: 404, error: "not_found" };
  if (set.ownerId !== userId) return { ok: false, status: 403, error: "forbidden" };
  return { ok: true, set };
}
