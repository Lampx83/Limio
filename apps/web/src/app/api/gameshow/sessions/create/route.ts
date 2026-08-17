import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { assertCanEditCourse, CourseAuthzError } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { generateUniqueGameCode } from "@/lib/gameshow/code";
import { ELIGIBLE_QUESTION_TYPES } from "@/lib/gameshow/constants";
import { snapshotQuestionsFromQuiz, snapshotQuestionsFromSet } from "@/lib/gameshow/sessionQuestions";
import { TEAM_COUNT_MAX, TEAM_COUNT_MIN, createTeamsForSession } from "@/lib/gameshow/teams";

export const runtime = "nodejs";

const BodySchema = z
  .object({
    quizId: z.string().min(1).optional(),
    questionSetId: z.string().min(1).optional(),
    teamCount: z.number().int().min(TEAM_COUNT_MIN).max(TEAM_COUNT_MAX).optional(),
  })
  .refine((v) => (v.quizId ? 1 : 0) + (v.questionSetId ? 1 : 0) === 1, {
    message: "Cần đúng 1 trong 2: quizId hoặc questionSetId",
  });

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "validation_failed" }, { status: 400 });
  }

  if (parsed.data.quizId) {
    return createFromQuiz(userId, parsed.data.quizId, parsed.data.teamCount);
  }
  return createFromQuestionSet(userId, parsed.data.questionSetId!, parsed.data.teamCount);
}

async function createFromQuiz(userId: string, quizId: string, teamCount?: number) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: {
      id: true,
      title: true,
      courseId: true,
      questions: { select: { id: true, type: true } },
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
    data: {
      code,
      title: quiz.title,
      quizId: quiz.id,
      hostId: userId,
      status: "lobby",
      teamModeEnabled: !!teamCount,
    },
  });
  const questionCount = await snapshotQuestionsFromQuiz(prisma, gameSession.id, quiz.id);
  if (teamCount) await createTeamsForSession(prisma, gameSession.id, teamCount);

  return Response.json({
    id: gameSession.id,
    code: gameSession.code,
    title: quiz.title,
    questionCount,
  });
}

async function createFromQuestionSet(userId: string, questionSetId: string, teamCount?: number) {
  const set = await prisma.gameQuestionSet.findUnique({
    where: { id: questionSetId },
    select: { id: true, title: true, ownerId: true, _count: { select: { items: true } } },
  });
  if (!set) return Response.json({ error: "question_set_not_found" }, { status: 404 });
  if (set.ownerId !== userId) return Response.json({ error: "forbidden" }, { status: 403 });
  if (set._count.items === 0) {
    return Response.json({ error: "no_eligible_questions" }, { status: 422 });
  }

  const code = await generateUniqueGameCode();
  const gameSession = await prisma.gameSession.create({
    data: {
      code,
      title: set.title,
      questionSetId: set.id,
      hostId: userId,
      status: "lobby",
      teamModeEnabled: !!teamCount,
    },
  });
  const questionCount = await snapshotQuestionsFromSet(prisma, gameSession.id, set.id);
  if (teamCount) await createTeamsForSession(prisma, gameSession.id, teamCount);

  return Response.json({
    id: gameSession.id,
    code: gameSession.code,
    title: set.title,
    questionCount,
  });
}
