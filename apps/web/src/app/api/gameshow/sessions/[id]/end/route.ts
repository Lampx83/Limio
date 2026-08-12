import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";
import { requireHostSession } from "@/lib/gameshow/host";
import { publishGameEnded } from "@/lib/gameshow/bus";

export const runtime = "nodejs";

// Host kết thúc sớm bất kỳ lúc nào (lobby/running/reveal -> ended).
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  const check = await requireHostSession(params.id, userId);
  if (!check.ok) return Response.json({ error: check.error }, { status: check.status });

  if (check.session.status === "ended") {
    return Response.json({ ok: true, noop: true });
  }

  await prisma.gameSession.update({
    where: { id: check.session.id },
    data: { status: "ended", endedAt: new Date() },
  });
  await publishGameEnded(check.session.id);

  return Response.json({ ok: true });
}
