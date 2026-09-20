/**
 * In-video quiz cuepoints (formative checks).
 *
 * The video player pauses at a cuepoint timestamp and asks the learner
 * to answer the referenced quiz before resuming. These attempts are
 * formative — they are NOT recorded as `QuizAttempt` rows (which would
 * inflate attempt counts and pollute scoring), only as `LearningEvent`
 * (`video.cuepoint.passed`) once all questions in the cuepoint quiz are
 * answered correctly.
 */

import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import type { DbClient } from "../auth/tokens";
import { emitEvent } from "../learning/events";
import { CourseError } from "../courses/courses";
import { gradeAnswer } from "./grading";

export const InlineGradeContext = z.object({
  contentItemId: z.string().uuid(),
  lessonId: z.string().uuid(),
  atSec: z.number().nonnegative(),
  attemptCount: z.number().int().positive(),
  totalDurationMs: z.number().int().nonnegative().optional(),
});

export const InlineGradeInput = z.object({
  responses: z
    .array(
      z.object({
        questionId: z.string().uuid(),
        response: z.unknown(),
      }),
    )
    .min(1)
    .max(50),
  context: InlineGradeContext,
});

export interface InlineGradeResult {
  results: Array<{ questionId: string; isCorrect: boolean }>;
  allCorrect: boolean;
  cuepointPassed: boolean;
}

/**
 * Grade a batch of cuepoint answers and (when all are correct) emit a
 * `video.cuepoint.passed` event. Caller is the authenticated learner.
 *
 * `eventKey` is derived from (userId, contentItemId, atSec) so repeated
 * passes of the same cuepoint within a learner's history are deduped —
 * we want one record per learner per cuepoint, not per video play.
 */
export async function gradeInlineCuepoint(
  learnerUserId: string,
  quizId: string,
  rawInput: unknown,
  db: DbClient = prisma,
): Promise<InlineGradeResult> {
  const parsed = InlineGradeInput.safeParse(rawInput);
  if (!parsed.success) {
    throw new CourseError("validation_failed", parsed.error.flatten());
  }
  const { responses, context } = parsed.data;

  // Load all questions in the cuepoint quiz that the client referenced.
  // We require every submitted questionId belong to this quiz.
  const questions = await db.quizQuestion.findMany({
    where: {
      quizId,
      id: { in: responses.map((r) => r.questionId) },
    },
    include: {
      options: { include: { misconception: { select: { code: true } } } },
    },
  });
  if (questions.length !== responses.length) {
    throw new CourseError("validation_failed", "question_not_in_quiz");
  }
  const byId = new Map(questions.map((q) => [q.id, q]));

  const results = responses.map((r) => {
    const q = byId.get(r.questionId)!;
    const ev = gradeAnswer(q, r.response);
    return { questionId: r.questionId, isCorrect: ev.isCorrect };
  });

  const allCorrect = results.every((r) => r.isCorrect);

  let cuepointPassed = false;
  if (allCorrect) {
    const eventKey = `cuepoint:${learnerUserId}:${context.contentItemId}:${Math.floor(context.atSec)}`;
    const r = await emitEvent(
      learnerUserId,
      LearningEventType.VideoCuepointPassed,
      {
        contentItemId: context.contentItemId,
        lessonId: context.lessonId,
        atSec: context.atSec,
        quizId,
        questionCount: questions.length,
        attemptCount: context.attemptCount,
        totalDurationMs: context.totalDurationMs,
      },
      { eventKey },
      db,
    );
    cuepointPassed = r.created;
  }

  return { results, allCorrect, cuepointPassed };
}

/**
 * Read a quiz + its questions + options shaped for a learner — strips
 * `isCorrect` and misconception linkage from options. Used by the
 * in-video cuepoint overlay so the player can render questions without
 * leaking answers via the JS bundle.
 */
export interface LearnerSafeOption {
  id: string;
  label: string;
  orderIndex: number;
  extra: unknown;
}
export interface LearnerSafeQuestion {
  id: string;
  type: string;
  prompt: string;
  points: number;
  orderIndex: number;
  extra: unknown;
  options: LearnerSafeOption[];
}
export interface LearnerSafeQuiz {
  id: string;
  title: string;
  description: string | null;
  requireConfidence: boolean;
  questions: LearnerSafeQuestion[];
}

export async function getLearnerSafeQuiz(
  quizId: string,
  db: DbClient = prisma,
): Promise<LearnerSafeQuiz | null> {
  const q = await db.quiz.findUnique({
    where: { id: quizId },
    select: {
      id: true,
      title: true,
      description: true,
      requireConfidence: true,
      questions: {
        orderBy: { orderIndex: "asc" },
        select: {
          id: true,
          type: true,
          prompt: true,
          points: true,
          orderIndex: true,
          extra: true,
          options: {
            orderBy: { orderIndex: "asc" },
            select: {
              id: true,
              label: true,
              orderIndex: true,
              extra: true,
            },
          },
        },
      },
    },
  });
  if (!q) return null;
  return q as LearnerSafeQuiz;
}
