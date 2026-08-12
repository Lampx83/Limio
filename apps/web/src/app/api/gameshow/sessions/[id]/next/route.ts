import { requireUserId } from "@/lib/session";
import { requireHostSession } from "@/lib/gameshow/host";
import { publishQuestionStarted, publishGameEnded } from "@/lib/gameshow/bus";
import { getSessionQuestions } from "@/lib/gameshow/sessionQuestions";
import { prisma } from "@feedbackme/db";

export const runtime = "nodejs";

// Từ "reveal" -> câu tiếp theo ("running") hoặc hết câu -> "ended".
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  const check = await requireHostSession(params.id, userId);
  if (!check.ok) return Response.json({ error: check.error }, { status: check.status });

  if (check.session.status !== "reveal") {
    return Response.json({ error: "invalid_status" }, { status: 409 });
  }

  const questions = await getSessionQuestions(check.session.id);
  const nextIndex = check.session.currentQuestionIndex + 1;
  const next = questions[nextIndex];

  if (!next) {
    await prisma.gameSession.update({
      where: { id: check.session.id },
      data: { status: "ended", endedAt: new Date() },
    });
    await publishGameEnded(check.session.id);
    return Response.json({ ok: true, ended: true });
  }

  const now = new Date();
  await prisma.gameSession.update({
    where: { id: check.session.id },
    data: { status: "running", currentQuestionIndex: nextIndex, currentQuestionStartedAt: now },
  });

  await publishQuestionStarted(check.session.id, {
    type: "question.started",
    questionIndex: nextIndex,
    questionId: next.id,
    prompt: next.prompt,
    options: next.options.map((o) => ({ id: o.id, label: o.label })),
    timeLimitMs: next.timeLimitSec * 1000,
    startedAt: now.getTime(),
  });

  return Response.json({ ok: true, questionIndex: nextIndex });
}
