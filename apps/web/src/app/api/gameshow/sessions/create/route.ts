import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { assertCanEditCourse, CourseAuthzError } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { generateUniqueGameCode } from "@/lib/gameshow/code";
import { ELIGIBLE_QUESTION_TYPES } from "@/lib/gameshow/constants";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = z.object({ quizId: z.string().min(1) }).safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "validation_failed" }, { status: 400 });
  }

  const quiz = await prisma.quiz.findUnique({
    where: { id: parsed.data.quizId },
    select: {
      id: true,
      title: true,
      courseId: true,
      questions: { select: { id: true, type: true }, orderBy: { orderIndex: "asc" } },
    },
  });
  if (!quiz || !quiz.courseId) {
    return Response.json({ error: "quiz_not_found" }, { status: 404 });
  }

  try {
    await assertCanEditCourse(userId, quiz.courseId);
  } catch (err) {
    if (err instanceof CourseAuthzError) {
      return Response.json(
        { error: err.code === "not_found" ? "course_not_found" : "forbidden" },
        { status: err.code === "not_found" ? 404 : 403 },
      );
    }
    throw err;
  }

  const eligibleCount = quiz.questions.filter((q) =>
    (ELIGIBLE_QUESTION_TYPES as readonly string[]).includes(q.type),
  ).length;
  if (eligibleCount === 0) {
    return Response.json({ error: "no_eligible_questions" }, { status: 422 });
  }

  const code = await generateUniqueGameCode();
  const gameSession = await prisma.gameSession.create({
    data: { code, quizId: quiz.id, hostId: userId, status: "lobby" },
  });

  return Response.json({
    id: gameSession.id,
    code: gameSession.code,
    quizTitle: quiz.title,
    questionCount: eligibleCount,
  });
}
