import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";
import { requireHostSession } from "@/lib/gameshow/host";
import { publishQuestionStarted, publishGameEnded } from "@/lib/gameshow/bus";
import { ELIGIBLE_QUESTION_TYPES, QUESTION_TIME_LIMIT_MS } from "@/lib/gameshow/constants";

export const runtime = "nodejs";

// Từ "reveal" -> câu tiếp theo ("running") hoặc hết câu -> "ended".
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  const check = await requireHostSession(params.id, userId);
  if (!check.ok) return Response.json({ error: check.error }, { status: check.status });

  if (check.session.status !== "reveal") {
    return Response.json({ error: "invalid_status" }, { status: 409 });
  }

  const quiz = await prisma.quiz.findUniqueOrThrow({
    where: { id: check.session.quizId },
    select: {
      questions: {
        orderBy: { orderIndex: "asc" },
        select: {
          id: true,
          type: true,
          prompt: true,
          options: { orderBy: { orderIndex: "asc" }, select: { id: true, label: true } },
        },
      },
    },
  });
  const questions = quiz.questions.filter((q) =>
    (ELIGIBLE_QUESTION_TYPES as readonly string[]).includes(q.type),
  );
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
    options: next.options,
    timeLimitMs: QUESTION_TIME_LIMIT_MS,
    startedAt: now.getTime(),
  });

  return Response.json({ ok: true, questionIndex: nextIndex });
}
