import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { verifyParticipant } from "@/lib/gameshow/participant";
import { applyScore, publishAnswerReceived } from "@/lib/gameshow/bus";
import { computeScore, type PowerUpType } from "@/lib/gameshow/scoring";
import { ELIGIBLE_QUESTION_TYPES, QUESTION_TIME_LIMIT_MS } from "@/lib/gameshow/constants";

export const runtime = "nodejs";

const BodySchema = z.object({
  participantId: z.string().min(1),
  participantToken: z.string().min(1),
  questionIndex: z.number().int().min(0),
  optionId: z.string().min(1),
  powerUp: z.enum(["double_points", "immunity"]).optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "validation_failed" }, { status: 400 });

  const participant = await verifyParticipant(
    params.id,
    parsed.data.participantId,
    parsed.data.participantToken,
  );
  if (!participant) return Response.json({ error: "unauthorized" }, { status: 401 });

  const gameSession = await prisma.gameSession.findUnique({ where: { id: params.id } });
  if (!gameSession) return Response.json({ error: "not_found" }, { status: 404 });
  if (gameSession.status !== "running") {
    return Response.json({ error: "invalid_status" }, { status: 409 });
  }
  if (parsed.data.questionIndex !== gameSession.currentQuestionIndex) {
    return Response.json({ error: "stale_question" }, { status: 409 });
  }

  const powerUp: PowerUpType | undefined = parsed.data.powerUp;
  if (powerUp === "double_points" && participant.doublePointsUsed) {
    return Response.json({ error: "power_up_already_used" }, { status: 409 });
  }
  if (powerUp === "immunity" && participant.immunityUsed) {
    return Response.json({ error: "power_up_already_used" }, { status: 409 });
  }

  // Cùng logic lọc eligible-type như start/next/reveal — currentQuestionIndex
  // trỏ vào danh sách ĐÃ LỌC, không phải QuizQuestion.orderIndex thô.
  const allQuestions = await prisma.quizQuestion.findMany({
    where: { quizId: gameSession.quizId },
    orderBy: { orderIndex: "asc" },
    select: { id: true, type: true, options: { select: { id: true, isCorrect: true } } },
  });
  const eligibleQuestions = allQuestions.filter((q) =>
    (ELIGIBLE_QUESTION_TYPES as readonly string[]).includes(q.type),
  );
  const question = eligibleQuestions[gameSession.currentQuestionIndex];
  if (!question) return Response.json({ error: "question_not_found" }, { status: 404 });

  const responseTimeMs = Math.max(
    0,
    Date.now() - (gameSession.currentQuestionStartedAt?.getTime() ?? Date.now()),
  );
  const isCorrect = question.options.some((o) => o.id === parsed.data.optionId && o.isCorrect);
  const pointsAwarded = computeScore({
    isCorrect,
    responseTimeMs,
    timeLimitMs: QUESTION_TIME_LIMIT_MS,
    powerUp,
  });

  try {
    await prisma.$transaction([
      prisma.gameAnswer.create({
        data: {
          sessionId: gameSession.id,
          participantId: participant.id,
          questionId: question.id,
          questionIndex: gameSession.currentQuestionIndex,
          chosenOptionId: parsed.data.optionId,
          isCorrect,
          responseTimeMs,
          pointsAwarded,
          powerUpUsed: powerUp ?? null,
        },
      }),
      prisma.gameParticipant.update({
        where: { id: participant.id },
        data: {
          totalScore: { increment: pointsAwarded },
          streak: isCorrect ? { increment: 1 } : { set: 0 },
          ...(powerUp === "double_points" ? { doublePointsUsed: true } : {}),
          ...(powerUp === "immunity" ? { immunityUsed: true } : {}),
        },
      }),
    ]);
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      return Response.json({ error: "already_answered" }, { status: 409 });
    }
    throw e;
  }

  await applyScore(gameSession.id, participant.id, pointsAwarded, isCorrect);

  const answeredCount = await prisma.gameAnswer.count({
    where: { sessionId: gameSession.id, questionIndex: gameSession.currentQuestionIndex },
  });
  await publishAnswerReceived(gameSession.id, gameSession.currentQuestionIndex, answeredCount);

  return Response.json({
    isCorrect,
    pointsAwarded,
    totalScore: participant.totalScore + pointsAwarded,
  });
}
