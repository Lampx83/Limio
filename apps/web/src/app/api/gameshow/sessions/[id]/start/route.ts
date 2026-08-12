import { requireUserId } from "@/lib/session";
import { requireHostSession } from "@/lib/gameshow/host";
import { publishQuestionStarted } from "@/lib/gameshow/bus";
import { getSessionQuestions } from "@/lib/gameshow/sessionQuestions";
import { prisma } from "@feedbackme/db";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  const check = await requireHostSession(params.id, userId);
  if (!check.ok) return Response.json({ error: check.error }, { status: check.status });

  if (check.session.status !== "lobby") {
    return Response.json({ error: "invalid_status" }, { status: 409 });
  }

  const questions = await getSessionQuestions(check.session.id);
  const first = questions[0];
  if (!first) return Response.json({ error: "no_eligible_questions" }, { status: 422 });

  const now = new Date();
  await prisma.gameSession.update({
    where: { id: check.session.id },
    data: {
      status: "running",
      startedAt: now,
      currentQuestionIndex: 0,
      currentQuestionStartedAt: now,
    },
  });

  await publishQuestionStarted(check.session.id, {
    type: "question.started",
    questionIndex: 0,
    questionId: first.id,
    prompt: first.prompt,
    options: first.options.map((o) => ({ id: o.id, label: o.label })),
    timeLimitMs: first.timeLimitSec * 1000,
    startedAt: now.getTime(),
  });

  return Response.json({ ok: true, questionIndex: 0 });
}
