import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";

/**
 * Walk an attempt's wrong answers, find any options the learner picked that
 * carry a `misconceptionId`, and upsert MisconceptionFlag rows. Emits one
 * `misconception.detected` event per distinct misconception flagged.
 *
 * If a previously-resolved flag is re-triggered, the row is "re-armed":
 * `resolved` flips back to false and `resolvedAt` is cleared, so a future
 * correct answer can resolve it again (a new cycle).
 */
export async function recordMisconceptionsFromAttempt(
  userId: string,
  attemptId: string,
  db: PrismaClient = prisma,
): Promise<{ detected: string[] }> {
  const responses = await db.answerResponse.findMany({
    where: { attemptId, isCorrect: false },
    select: {
      response: true,
      questionId: true,
      question: {
        select: {
          options: {
            select: { id: true, isCorrect: true, misconceptionId: true },
          },
        },
      },
    },
  });

  const detected: string[] = [];
  for (const r of responses) {
    if (!Array.isArray(r.response)) continue;
    const selectedIds = r.response.filter(
      (x): x is string => typeof x === "string",
    );
    for (const opt of r.question.options) {
      if (
        !opt.isCorrect &&
        opt.misconceptionId &&
        selectedIds.includes(opt.id)
      ) {
        const flag = await db.misconceptionFlag.upsert({
          where: {
            userId_misconceptionId: {
              userId,
              misconceptionId: opt.misconceptionId,
            },
          },
          create: {
            userId,
            misconceptionId: opt.misconceptionId,
          },
          update: {
            count: { increment: 1 },
            lastDetectedAt: new Date(),
            // Re-arm: a previously-resolved misconception can resurface.
            resolved: false,
            resolvedAt: null,
          },
        });
        detected.push(opt.misconceptionId);
        await db.learningEvent.create({
          data: {
            userId,
            eventType: LearningEventType.MisconceptionDetected,
            payload: {
              misconceptionId: opt.misconceptionId,
              flagId: flag.id,
              count: flag.count,
              questionId: r.questionId,
              attemptId,
            } as Prisma.InputJsonValue,
          },
        });
      }
    }
  }

  return { detected };
}

/**
 * For each correctly-answered question in this attempt that *could* have
 * triggered a misconception (i.e. has a wrong option carrying that
 * misconceptionId), check whether the learner currently has an unresolved
 * flag for that misconception. If yes, mark it resolved and emit one
 * `misconception.resolved` event.
 *
 * Idempotent — once a flag is resolved (resolved=true), subsequent attempts
 * skip it. A flag becomes resolvable again only after `recordMisconceptionsFromAttempt`
 * re-detects it (count++, resolved=false).
 *
 * `excludeMisconceptionIds` lets the caller skip flags that were JUST detected
 * in this same attempt — without it, an attempt with one wrong + one correct
 * answer for the same misconception would self-resolve immediately.
 */
export async function detectAndMarkResolved(
  userId: string,
  attemptId: string,
  options: { excludeMisconceptionIds?: string[] } = {},
  db: PrismaClient = prisma,
): Promise<{ resolved: string[] }> {
  const exclude = new Set(options.excludeMisconceptionIds ?? []);

  const correctResponses = await db.answerResponse.findMany({
    where: { attemptId, isCorrect: true },
    select: {
      questionId: true,
      question: {
        select: {
          options: {
            select: { isCorrect: true, misconceptionId: true },
          },
          skillTags: { select: { skillId: true } },
        },
      },
    },
  });

  const resolved: string[] = [];
  for (const r of correctResponses) {
    const trapMisconceptionIds = Array.from(
      new Set(
        r.question.options
          .filter(
            (o): o is { isCorrect: boolean; misconceptionId: string } =>
              !o.isCorrect && o.misconceptionId !== null,
          )
          .map((o) => o.misconceptionId),
      ),
    ).filter((id) => !exclude.has(id) && !resolved.includes(id));

    if (trapMisconceptionIds.length === 0) continue;

    const flags = await db.misconceptionFlag.findMany({
      where: {
        userId,
        misconceptionId: { in: trapMisconceptionIds },
        resolved: false,
      },
      include: { misconception: { select: { code: true } } },
    });

    const skillIds = r.question.skillTags.map((t) => t.skillId);

    for (const flag of flags) {
      await db.misconceptionFlag.update({
        where: { id: flag.id },
        data: { resolved: true, resolvedAt: new Date() },
      });
      await db.learningEvent.create({
        data: {
          userId,
          eventType: LearningEventType.MisconceptionResolved,
          payload: {
            misconceptionId: flag.misconceptionId,
            misconceptionCode: flag.misconception.code,
            flagId: flag.id,
            skillIds,
            attemptId,
            questionId: r.questionId,
          } as Prisma.InputJsonValue,
        },
      });
      resolved.push(flag.misconceptionId);
    }
  }

  return { resolved };
}
