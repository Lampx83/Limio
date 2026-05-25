import { z } from "zod";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { assertCanEditCourse, CourseAuthzError } from "../courses/authz";
import { attachLessonActivity } from "../courses/lessonActivity";
import { QuizError } from "./types";

export const CreateQuizInput = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().max(5_000).optional(),
  difficulty: z.number().int().min(1).max(5).optional(),
  passThresholdPct: z.number().int().min(0).max(100).optional(),
  // null = tắt giới hạn thời gian; số dương = số giây (tối đa 24h).
  timeLimitSec: z.number().int().positive().max(86_400).nullable().optional(),
  maxAttempts: z.number().int().positive().max(100).optional(),
  randomizeOrder: z.boolean().optional(),
  requireConfidence: z.boolean().optional(),
  isHidden: z.boolean().optional(),
});

export const UpdateQuizInput = CreateQuizInput.partial();

/** Create a quiz scoped to a course (and optionally a lesson within it). */
export async function createQuiz(
  actorUserId: string,
  scope: { courseId: string; lessonId?: string },
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<{ quizId: string }> {
  await assertCanEditCourse(actorUserId, scope.courseId, db);
  const parsed = CreateQuizInput.safeParse(rawInput);
  if (!parsed.success) throw new QuizError("validation_failed", parsed.error.flatten());

  // If lessonId provided, sanity-check it belongs to the same course.
  if (scope.lessonId) {
    const lesson = await db.lesson.findUnique({
      where: { id: scope.lessonId },
      select: { module: { select: { courseId: true } } },
    });
    if (!lesson || lesson.module.courseId !== scope.courseId) {
      throw new QuizError("validation_failed", "lesson does not belong to course");
    }
  }

  // Wrap entity create + LessonActivity attach in one transaction. Lesson-scoped
  // regular quizzes get a LessonActivity row so they appear in the unified
  // ordered activity list. Course-scoped (no lessonId) quizzes are skipped.
  // Cuepoint quizzes never reach this code path (they go through
  // createCuepointQuiz which sets cuepointOnly=true and is excluded by design).
  const quizId = await db.$transaction(async (tx) => {
    const quiz = await tx.quiz.create({
      data: {
        courseId: scope.courseId,
        lessonId: scope.lessonId ?? null,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        difficulty: parsed.data.difficulty ?? null,
        passThresholdPct: parsed.data.passThresholdPct ?? 70,
        timeLimitSec: parsed.data.timeLimitSec ?? null,
        maxAttempts: parsed.data.maxAttempts ?? null,
        randomizeOrder: parsed.data.randomizeOrder ?? false,
        requireConfidence: parsed.data.requireConfidence ?? true,
      },
    });
    if (scope.lessonId) {
      await attachLessonActivity(tx, scope.lessonId, "quiz", quiz.id);
    }
    return quiz.id;
  });
  return { quizId };
}

async function getCourseIdForQuiz(quizId: string, db: PrismaClient): Promise<string> {
  const q = await db.quiz.findUnique({ where: { id: quizId }, select: { courseId: true } });
  if (!q || !q.courseId) throw new QuizError("quiz_not_found");
  return q.courseId;
}

export async function updateQuiz(
  actorUserId: string,
  quizId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<void> {
  const courseId = await getCourseIdForQuiz(quizId, db);
  await assertCanEditCourse(actorUserId, courseId, db);
  const parsed = UpdateQuizInput.safeParse(rawInput);
  if (!parsed.success) throw new QuizError("validation_failed", parsed.error.flatten());
  const data = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));
  if (Object.keys(data).length === 0) return;
  await db.quiz.update({ where: { id: quizId }, data });
}

export async function deleteQuiz(
  actorUserId: string,
  quizId: string,
  opts: { force?: boolean } = {},
  db: PrismaClient = prisma,
): Promise<void> {
  const courseId = await getCourseIdForQuiz(quizId, db);
  await assertCanEditCourse(actorUserId, courseId, db);

  const attemptCount = await db.quizAttempt.count({ where: { quizId } });
  if (attemptCount > 0 && !opts.force) {
    throw new QuizError("quiz_has_attempts", { attemptCount });
  }

  // Schema có cascade Quiz → QuizQuestion → QuestionOption / QuestionSkillTag,
  // và QuizAttempt → AnswerResponse. Nhưng QuizAttempt → Quiz và
  // AnswerResponse → QuizQuestion KHÔNG cascade, nên phải xoá attempts trước.
  await db.$transaction([
    db.quizAttempt.deleteMany({ where: { quizId } }),
    db.quiz.delete({ where: { id: quizId } }),
  ]);
}

export { CourseAuthzError };
