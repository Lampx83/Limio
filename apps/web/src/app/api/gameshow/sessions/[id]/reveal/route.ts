import { requireUserId } from "@/lib/session";
import { requireHostSession } from "@/lib/gameshow/host";
import { publishQuestionEnded } from "@/lib/gameshow/bus";
import { getSessionQuestions } from "@/lib/gameshow/sessionQuestions";
import { prisma } from "@feedbackme/db";

export const runtime = "nodejs";

// Kết thúc câu hỏi hiện tại: lộ đáp án đúng + leaderboard mới nhất.
// Session chuyển "running" -> "reveal". Không tự động sang câu kế — host
// bấm "next" riêng để chủ động canh thời gian đọc kết quả.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  const check = await requireHostSession(params.id, userId);
  if (!check.ok) return Response.json({ error: check.error }, { status: check.status });

  if (check.session.status !== "running") {
    return Response.json({ error: "invalid_status" }, { status: 409 });
  }

  const questions = await getSessionQuestions(check.session.id);
  const current = questions[check.session.currentQuestionIndex];
  const correctOptionId = current?.options.find((o) => o.isCorrect)?.id ?? null;

  await prisma.gameSession.update({ where: { id: check.session.id }, data: { status: "reveal" } });
  await publishQuestionEnded(check.session.id, check.session.currentQuestionIndex, correctOptionId);

  return Response.json({ ok: true, correctOptionId });
}
