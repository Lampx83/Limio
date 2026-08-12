import { prisma } from "@feedbackme/db";
import { getSessionSnapshot } from "@/lib/gameshow/bus";
import { getSessionQuestions } from "@/lib/gameshow/sessionQuestions";

export const runtime = "nodejs";

// Public — participant dùng để rehydrate state khi reload trang giữa chừng.
// KHÔNG BAO GIỜ trả isCorrect của option — chỉ lộ ở question.ended/SSE.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const gameSession = await prisma.gameSession.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      status: true,
      title: true,
      currentQuestionIndex: true,
      currentQuestionStartedAt: true,
    },
  });
  if (!gameSession) return Response.json({ error: "not_found" }, { status: 404 });

  const questions = await getSessionQuestions(gameSession.id);
  const currentQuestion = questions[gameSession.currentQuestionIndex] ?? null;
  const participants = await getSessionSnapshot(gameSession.id);

  const url = new URL(req.url);
  const participantId = url.searchParams.get("participantId");
  let alreadyAnswered = false;
  if (participantId && currentQuestion) {
    const answer = await prisma.gameAnswer.findUnique({
      where: {
        participantId_questionIndex: {
          participantId,
          questionIndex: gameSession.currentQuestionIndex,
        },
      },
      select: { id: true },
    });
    alreadyAnswered = !!answer;
  }

  // "reveal"/"ended" — đáp án đã công khai cho cả phòng, an toàn để lộ khi
  // client reconnect ngay trong lúc host đang hiện kết quả (SSE không replay
  // event đã fire trước khi client này connect).
  const revealed = gameSession.status === "reveal" || gameSession.status === "ended";
  const correctOptionId = revealed
    ? (currentQuestion?.options.find((o) => o.isCorrect)?.id ?? null)
    : null;

  return Response.json({
    id: gameSession.id,
    status: gameSession.status,
    quizTitle: gameSession.title,
    questionCount: questions.length,
    currentQuestionIndex: gameSession.currentQuestionIndex,
    currentQuestionStartedAt: gameSession.currentQuestionStartedAt?.getTime() ?? null,
    timeLimitMs: (currentQuestion?.timeLimitSec ?? 20) * 1000,
    currentQuestion: currentQuestion
      ? {
          id: currentQuestion.id,
          prompt: currentQuestion.prompt,
          options: currentQuestion.options.map((o) => ({ id: o.id, label: o.label })),
        }
      : null,
    correctOptionId,
    alreadyAnswered,
    participants,
  });
}
