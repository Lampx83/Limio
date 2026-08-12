import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";
import { getSessionSnapshot } from "@/lib/gameshow/bus";
import { ELIGIBLE_QUESTION_TYPES, QUESTION_TIME_LIMIT_MS } from "@/lib/gameshow/constants";

export const runtime = "nodejs";

// Host-only — bao gồm đáp án đúng, KHÔNG bao giờ dùng route này cho participant.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const gameSession = await prisma.gameSession.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      code: true,
      status: true,
      hostId: true,
      currentQuestionIndex: true,
      currentQuestionStartedAt: true,
      quiz: {
        select: {
          title: true,
          questions: {
            orderBy: { orderIndex: "asc" },
            select: {
              id: true,
              type: true,
              prompt: true,
              options: {
                orderBy: { orderIndex: "asc" },
                select: { id: true, label: true, isCorrect: true },
              },
            },
          },
        },
      },
    },
  });
  if (!gameSession) return Response.json({ error: "not_found" }, { status: 404 });
  if (gameSession.hostId !== userId) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const questions = gameSession.quiz.questions.filter((q) =>
    (ELIGIBLE_QUESTION_TYPES as readonly string[]).includes(q.type),
  );
  const participants = await getSessionSnapshot(gameSession.id);

  return Response.json({
    id: gameSession.id,
    code: gameSession.code,
    status: gameSession.status,
    quizTitle: gameSession.quiz.title,
    currentQuestionIndex: gameSession.currentQuestionIndex,
    currentQuestionStartedAt: gameSession.currentQuestionStartedAt?.getTime() ?? null,
    timeLimitMs: QUESTION_TIME_LIMIT_MS,
    questions,
    participants,
  });
}
