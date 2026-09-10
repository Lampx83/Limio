import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";
import { getSessionSnapshot, getTeamStandings } from "@/lib/gameshow/bus";
import { getSessionQuestions } from "@/lib/gameshow/sessionQuestions";

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
      title: true,
      teamModeEnabled: true,
      currentQuestionIndex: true,
      currentQuestionStartedAt: true,
      teams: { select: { id: true, name: true, colorKey: true } },
    },
  });
  if (!gameSession) return Response.json({ error: "not_found" }, { status: 404 });
  if (gameSession.hostId !== userId) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const [questions, participants, answeredParticipants] = await Promise.all([
    getSessionQuestions(gameSession.id),
    getSessionSnapshot(gameSession.id),
    prisma.gameAnswer.findMany({
      where: { sessionId: gameSession.id, questionIndex: gameSession.currentQuestionIndex },
      select: { participantId: true },
    }),
  ]);
  const teamStandings = gameSession.teamModeEnabled
    ? await getTeamStandings(gameSession.id, participants)
    : [];

  return Response.json({
    id: gameSession.id,
    code: gameSession.code,
    status: gameSession.status,
    quizTitle: gameSession.title,
    teamModeEnabled: gameSession.teamModeEnabled,
    teams: gameSession.teams,
    currentQuestionIndex: gameSession.currentQuestionIndex,
    currentQuestionStartedAt: gameSession.currentQuestionStartedAt?.getTime() ?? null,
    timeLimitMs: (questions[gameSession.currentQuestionIndex]?.timeLimitSec ?? 20) * 1000,
    answeredCount: answeredParticipants.length,
    // Host cần biết CHÍNH XÁC ai đã nộp (không chỉ đếm) để tô chấm trạng thái
    // sống trên bảng xếp hạng — join giữa chừng/tải lại trang không mất data.
    answeredParticipantIds: answeredParticipants.map((a) => a.participantId),
    questions,
    participants,
    teamStandings,
  });
}
