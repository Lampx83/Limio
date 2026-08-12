import { prisma } from "@feedbackme/db";
import { ELIGIBLE_QUESTION_TYPES } from "@/lib/gameshow/constants";

export const runtime = "nodejs";

// Public — participant xem thông tin phòng trước khi nhập tên để join.
export async function GET(_req: Request, { params }: { params: { code: string } }) {
  const gameSession = await prisma.gameSession.findUnique({
    where: { code: params.code.toUpperCase() },
    select: {
      id: true,
      status: true,
      quiz: { select: { title: true, questions: { select: { type: true } } } },
      _count: { select: { participants: true } },
    },
  });
  if (!gameSession) return Response.json({ error: "not_found" }, { status: 404 });

  const questionCount = gameSession.quiz.questions.filter((q) =>
    (ELIGIBLE_QUESTION_TYPES as readonly string[]).includes(q.type),
  ).length;

  return Response.json({
    id: gameSession.id,
    status: gameSession.status,
    quizTitle: gameSession.quiz.title,
    questionCount,
    participantCount: gameSession._count.participants,
  });
}
