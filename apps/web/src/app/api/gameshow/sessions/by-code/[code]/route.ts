import { prisma } from "@feedbackme/db";

export const runtime = "nodejs";

// Public — participant xem thông tin phòng trước khi nhập tên để join.
export async function GET(_req: Request, { params }: { params: { code: string } }) {
  const gameSession = await prisma.gameSession.findUnique({
    where: { code: params.code.toUpperCase() },
    select: {
      id: true,
      status: true,
      title: true,
      _count: { select: { participants: true, questions: true } },
    },
  });
  if (!gameSession) return Response.json({ error: "not_found" }, { status: 404 });

  return Response.json({
    id: gameSession.id,
    status: gameSession.status,
    quizTitle: gameSession.title,
    questionCount: gameSession._count.questions,
    participantCount: gameSession._count.participants,
  });
}
