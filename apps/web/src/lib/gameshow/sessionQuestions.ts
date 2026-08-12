import { prisma, type PrismaClient } from "@feedbackme/db";
import { ELIGIBLE_QUESTION_TYPES } from "./constants";

type Db = PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/**
 * Snapshot câu hỏi vào GameSessionQuestion lúc tạo phiên — từ Quiz (lọc
 * mcq/true_false) hoặc từ GameQuestionSet tự soạn. Sau bước này mọi route
 * điều khiển game chỉ đọc GameSessionQuestion, không đụng lại Quiz/Set gốc.
 */
export async function snapshotQuestionsFromQuiz(
  db: Db,
  sessionId: string,
  quizId: string,
): Promise<number> {
  const questions = await db.quizQuestion.findMany({
    where: { quizId },
    orderBy: { orderIndex: "asc" },
    select: {
      type: true,
      prompt: true,
      options: { orderBy: { orderIndex: "asc" }, select: { label: true, isCorrect: true } },
    },
  });
  const eligible = questions.filter((q) =>
    (ELIGIBLE_QUESTION_TYPES as readonly string[]).includes(q.type),
  );

  let index = 0;
  for (const q of eligible) {
    await db.gameSessionQuestion.create({
      data: {
        sessionId,
        orderIndex: index++,
        type: q.type,
        prompt: q.prompt,
        timeLimitSec: 20,
        options: {
          create: q.options.map((o, i) => ({ label: o.label, isCorrect: o.isCorrect, orderIndex: i })),
        },
      },
    });
  }
  return eligible.length;
}

export async function snapshotQuestionsFromSet(
  db: Db,
  sessionId: string,
  questionSetId: string,
): Promise<number> {
  const items = await db.gameQuestionSetItem.findMany({
    where: { setId: questionSetId },
    orderBy: { orderIndex: "asc" },
    include: { options: { orderBy: { orderIndex: "asc" } } },
  });

  let index = 0;
  for (const it of items) {
    await db.gameSessionQuestion.create({
      data: {
        sessionId,
        orderIndex: index++,
        type: it.type,
        prompt: it.prompt,
        timeLimitSec: it.timeLimitSec,
        options: {
          create: it.options.map((o) => ({
            label: o.label,
            isCorrect: o.isCorrect,
            orderIndex: o.orderIndex,
          })),
        },
      },
    });
  }
  return items.length;
}

export interface SessionQuestion {
  id: string;
  orderIndex: number;
  type: string;
  prompt: string;
  timeLimitSec: number;
  options: Array<{ id: string; label: string; isCorrect: boolean }>;
}

export async function getSessionQuestions(sessionId: string): Promise<SessionQuestion[]> {
  const rows = await prisma.gameSessionQuestion.findMany({
    where: { sessionId },
    orderBy: { orderIndex: "asc" },
    include: { options: { orderBy: { orderIndex: "asc" } } },
  });
  return rows.map((r) => ({
    id: r.id,
    orderIndex: r.orderIndex,
    type: r.type,
    prompt: r.prompt,
    timeLimitSec: r.timeLimitSec,
    options: r.options.map((o) => ({ id: o.id, label: o.label, isCorrect: o.isCorrect })),
  }));
}
