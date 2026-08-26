import { z } from "zod";
import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { assertCanEditCourse } from "../courses/authz";
import { QuizError } from "./types";
import { CreateQuestionInput, UpdateQuestionInput } from "./questions";
import { ensureQuestionTag } from "../courses/autoTags";

const CuepointQuestionInput = CreateQuestionInput
  .innerType()
  .extend({
    // Cuepoint inline questions must always tag at least one skill (CLAUDE.md §4.4).
    skillIds: z.array(z.string().uuid()).min(1).max(20),
  })
  // orderIndex is fixed (single question per cuepoint quiz) — caller need not pass it.
  .omit({ orderIndex: true });

export const CreateCuepointQuizInput = z.object({
  atSec: z.number().nonnegative(),
  question: CuepointQuestionInput,
});

export const UpdateCuepointQuizInput = z.object({
  atSec: z.number().nonnegative().optional(),
  question: UpdateQuestionInput.extend({
    skillIds: z.array(z.string().uuid()).min(1).max(20).optional(),
  }).optional(),
});

function formatTimestamp(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

async function getLessonCourseId(
  lessonId: string,
  db: PrismaClient,
): Promise<string | null> {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { module: { select: { courseId: true } } },
  });
  return lesson?.module.courseId ?? null;
}

/**
 * Create a Quiz that exists solely to back one in-video cuepoint. The quiz is
 * hidden from learner lesson-quiz lists (`isHidden`, `cuepointOnly`) and
 * carries exactly one question. The question itself is a regular
 * `QuizQuestion` — it shows up in the course Question Bank with a "Cuepoint"
 * badge and can be cloned into other quizzes later.
 *
 * `passThresholdPct` is forced to 100 so the player only resumes on a
 * perfect answer (cuepoints gate playback).
 */
export async function createCuepointQuiz(
  actorUserId: string,
  lessonId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<{ quizId: string; questionId: string }> {
  const courseId = await getLessonCourseId(lessonId, db);
  if (!courseId) throw new QuizError("validation_failed", "lesson_not_found");
  await assertCanEditCourse(actorUserId, courseId, db);

  const parsed = CreateCuepointQuizInput.safeParse(rawInput);
  if (!parsed.success) throw new QuizError("validation_failed", parsed.error.flatten());

  // Re-run CreateQuestionInput's superRefine (options/type cross-checks) on
  // the question payload by parsing through it with orderIndex=0.
  const questionParsed = CreateQuestionInput.safeParse({
    ...parsed.data.question,
    orderIndex: 0,
  });
  if (!questionParsed.success) {
    throw new QuizError("validation_failed", questionParsed.error.flatten());
  }
  const q = questionParsed.data;

  return db.$transaction(async (tx) => {
    const quiz = await tx.quiz.create({
      data: {
        courseId,
        lessonId,
        title: `Cuepoint @ ${formatTimestamp(parsed.data.atSec)}`,
        passThresholdPct: 100,
        isHidden: true,
        cuepointOnly: true,
        requireConfidence: false,
      },
    });
    const question = await tx.quizQuestion.create({
      data: {
        quizId: quiz.id,
        type: q.type,
        prompt: q.prompt,
        explanation: q.explanation ?? null,
        points: q.points ?? 1,
        orderIndex: 0,
        extra: q.extra ? (q.extra as Prisma.InputJsonValue) : Prisma.JsonNull,
        options: {
          create: (q.options ?? []).map((o, i) => ({
            label: o.label,
            isCorrect: o.isCorrect,
            misconceptionId: o.misconceptionId ?? null,
            orderIndex: i,
            extra: o.extra ? (o.extra as Prisma.InputJsonValue) : Prisma.JsonNull,
          })),
        },
      },
    });
    if (parsed.data.question.skillIds.length > 0) {
      await tx.questionSkillTag.createMany({
        data: parsed.data.question.skillIds.map((skillId) => ({
          questionId: question.id,
          skillId,
        })),
        skipDuplicates: true,
      });
    } else {
      await ensureQuestionTag(question.id, tx);
    }
    return { quizId: quiz.id, questionId: question.id };
  });
}

/**
 * Update the single question backing a cuepoint quiz. Refuses to operate on
 * a quiz that isn't `cuepointOnly` or that somehow has != 1 question (data
 * corruption — caller should use the regular question API instead).
 */
export async function updateCuepointQuiz(
  actorUserId: string,
  quizId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<void> {
  const quiz = await db.quiz.findUnique({
    where: { id: quizId },
    select: {
      courseId: true,
      cuepointOnly: true,
      questions: { select: { id: true } },
    },
  });
  if (!quiz || !quiz.courseId) throw new QuizError("quiz_not_found");
  if (!quiz.cuepointOnly) throw new QuizError("validation_failed", "not_cuepoint_quiz");
  if (quiz.questions.length !== 1) {
    throw new QuizError("validation_failed", "cuepoint_quiz_must_have_one_question");
  }
  await assertCanEditCourse(actorUserId, quiz.courseId, db);

  const parsed = UpdateCuepointQuizInput.safeParse(rawInput);
  if (!parsed.success) throw new QuizError("validation_failed", parsed.error.flatten());
  const { atSec, question } = parsed.data;

  await db.$transaction(async (tx) => {
    if (atSec !== undefined) {
      await tx.quiz.update({
        where: { id: quizId },
        data: { title: `Cuepoint @ ${formatTimestamp(atSec)}` },
      });
    }
    if (!question) return;

    const questionId = quiz.questions[0]!.id;
    const { options, skillIds, extra, ...scalarFields } = question;

    const scalarData = Object.fromEntries(
      Object.entries({ ...scalarFields, extra }).filter(([, v]) => v !== undefined),
    ) as Record<string, unknown>;
    if ("extra" in scalarData) {
      scalarData.extra =
        scalarData.extra === null ? Prisma.JsonNull : (scalarData.extra as Prisma.InputJsonValue);
    }
    if (Object.keys(scalarData).length > 0) {
      await tx.quizQuestion.update({ where: { id: questionId }, data: scalarData });
    }
    if (options !== undefined) {
      await tx.questionOption.deleteMany({ where: { questionId } });
      if (options.length > 0) {
        await tx.questionOption.createMany({
          data: options.map((o, i) => ({
            questionId,
            label: o.label,
            isCorrect: o.isCorrect,
            misconceptionId: o.misconceptionId ?? null,
            orderIndex: i,
            extra: o.extra ? (o.extra as Prisma.InputJsonValue) : Prisma.JsonNull,
          })),
        });
      }
    }
    if (skillIds !== undefined) {
      await tx.questionSkillTag.deleteMany({ where: { questionId } });
      if (skillIds.length > 0) {
        await tx.questionSkillTag.createMany({
          data: skillIds.map((skillId) => ({ questionId, skillId })),
          skipDuplicates: true,
        });
      } else {
        await ensureQuestionTag(questionId, tx);
      }
    }
  });
}

/**
 * Delete a cuepoint quiz only if no `ContentItem` still references it via a
 * cuepoint entry. Safe to call after a user removes a cuepoint row in the
 * editor — if some other content item picked the same quiz manually, the
 * delete is a no-op.
 *
 * Returns `true` when the quiz was deleted, `false` if it's still referenced
 * (or wasn't a cuepoint quiz to begin with).
 */
export async function deleteCuepointQuizIfOrphan(
  actorUserId: string,
  quizId: string,
  db: PrismaClient = prisma,
): Promise<boolean> {
  const quiz = await db.quiz.findUnique({
    where: { id: quizId },
    select: { courseId: true, lessonId: true, cuepointOnly: true },
  });
  if (!quiz || !quiz.courseId || !quiz.cuepointOnly) return false;
  await assertCanEditCourse(actorUserId, quiz.courseId, db);

  // Scan video content items on the same lesson for any cuepoint still
  // referencing this quizId. Cuepoint quizzes are always lesson-scoped.
  if (quiz.lessonId) {
    const referencingItems = await db.contentItem.findMany({
      where: { lessonId: quiz.lessonId, type: "video" },
      select: { payload: true },
    });
    const stillReferenced = referencingItems.some((item) => {
      const payload = item.payload as { cuepoints?: { quizId?: string }[] } | null;
      const cuepoints = payload?.cuepoints ?? [];
      return cuepoints.some((c) => c.quizId === quizId);
    });
    if (stillReferenced) return false;
  }

  await db.quiz.delete({ where: { id: quizId } });
  return true;
}

/**
 * Delete every cuepoint-only quiz on a lesson that no video ContentItem on
 * the same lesson references. Called after content-item create / update /
 * delete so orphaned cuepoint quizzes (e.g. instructor removed a cuepoint
 * row) get cleaned up without the UI having to explicitly call delete.
 *
 * Safe to call repeatedly — quizzes still referenced are left alone.
 */
export async function cleanupOrphanedCuepointQuizzes(
  actorUserId: string,
  lessonId: string,
  db: PrismaClient = prisma,
): Promise<{ deletedQuizIds: string[] }> {
  const courseId = await getLessonCourseId(lessonId, db);
  if (!courseId) return { deletedQuizIds: [] };
  await assertCanEditCourse(actorUserId, courseId, db);

  const cuepointQuizzes = await db.quiz.findMany({
    where: { lessonId, cuepointOnly: true },
    select: { id: true },
  });
  if (cuepointQuizzes.length === 0) return { deletedQuizIds: [] };

  const videoItems = await db.contentItem.findMany({
    where: { lessonId, type: "video" },
    select: { payload: true },
  });
  const referenced = new Set<string>();
  for (const item of videoItems) {
    const payload = item.payload as { cuepoints?: { quizId?: string }[] } | null;
    for (const c of payload?.cuepoints ?? []) {
      if (c.quizId) referenced.add(c.quizId);
    }
  }

  const orphans = cuepointQuizzes.filter((q) => !referenced.has(q.id));
  if (orphans.length === 0) return { deletedQuizIds: [] };
  await db.quiz.deleteMany({ where: { id: { in: orphans.map((q) => q.id) } } });
  return { deletedQuizIds: orphans.map((q) => q.id) };
}

/**
 * Read a cuepoint quiz with its single question + options + skill tags.
 * Used by the cuepoint editor when re-opening an existing video to
 * prefill the inline-question form.
 */
export async function getCuepointQuiz(
  actorUserId: string,
  quizId: string,
  db: PrismaClient = prisma,
): Promise<{
  quizId: string;
  cuepointOnly: boolean;
  question: {
    id: string;
    type: string;
    prompt: string;
    explanation: string | null;
    points: number;
    extra: unknown;
    options: { id: string; label: string; isCorrect: boolean; orderIndex: number; misconceptionId: string | null; extra: unknown }[];
    skillIds: string[];
  } | null;
}> {
  const quiz = await db.quiz.findUnique({
    where: { id: quizId },
    select: {
      id: true,
      courseId: true,
      cuepointOnly: true,
      questions: {
        select: {
          id: true,
          type: true,
          prompt: true,
          explanation: true,
          points: true,
          extra: true,
          options: {
            orderBy: { orderIndex: "asc" },
            select: {
              id: true,
              label: true,
              isCorrect: true,
              orderIndex: true,
              misconceptionId: true,
              extra: true,
            },
          },
          skillTags: { select: { skillId: true } },
        },
      },
    },
  });
  if (!quiz || !quiz.courseId) throw new QuizError("quiz_not_found");
  await assertCanEditCourse(actorUserId, quiz.courseId, db);

  const q = quiz.questions[0];
  return {
    quizId: quiz.id,
    cuepointOnly: quiz.cuepointOnly,
    question: q
      ? {
          id: q.id,
          type: q.type,
          prompt: q.prompt,
          explanation: q.explanation,
          points: q.points,
          extra: q.extra,
          options: q.options,
          skillIds: q.skillTags.map((t) => t.skillId),
        }
      : null,
  };
}
