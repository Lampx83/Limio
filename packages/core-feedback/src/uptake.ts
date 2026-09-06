/**
 * B9.2 — remediation uptake.
 *
 * The engine routes a learner to a lesson; until now nothing recorded whether
 * they went. Uptake is the mediating variable in feedback research — feedback
 * that is never acted on cannot help — so without this event no claim about
 * effectiveness can be separated from "they never read it".
 *
 * One event per click. The log is append-only and repeat visits are real
 * signal, so nothing is deduplicated here; analysis that wants first-touch
 * takes min(occurredAt) per (deliveryId, lessonId).
 */

import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";

export class RemediationClickError extends Error {
  constructor(
    public readonly code: "delivery_not_found" | "forbidden" | "lesson_not_offered",
  ) {
    super(code);
  }
}

/**
 * AC-4.1..4.4 — record that the learner opened one of the lessons this delivery
 * offered.
 *
 * `lessonId` is checked against the delivery's own remediation list rather than
 * merely against the lesson table: the endpoint is learner-callable, and
 * without that check anyone could inject uptake events for arbitrary lessons
 * and quietly corrupt the measure.
 */
export async function recordRemediationClick(
  userId: string,
  deliveryId: string,
  lessonId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const delivery = await db.feedbackDelivery.findUnique({
    where: { id: deliveryId },
    select: {
      id: true,
      userId: true,
      attemptId: true,
      questionId: true,
      remediationLessonIds: true,
    },
  });
  if (!delivery) throw new RemediationClickError("delivery_not_found");
  if (delivery.userId !== userId) throw new RemediationClickError("forbidden");

  const offered = Array.isArray(delivery.remediationLessonIds)
    ? (delivery.remediationLessonIds as unknown[]).filter(
        (x): x is string => typeof x === "string",
      )
    : [];
  if (!offered.includes(lessonId)) {
    throw new RemediationClickError("lesson_not_offered");
  }

  // courseId is denormalised onto the event so uptake can be aggregated per
  // course without joining back through attempt → quiz.
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { module: { select: { courseId: true } } },
  });

  await db.learningEvent.create({
    data: {
      userId,
      courseId: lesson?.module.courseId ?? null,
      eventType: LearningEventType.FeedbackRemediationClicked,
      payload: {
        deliveryId,
        lessonId,
        questionId: delivery.questionId,
        attemptId: delivery.attemptId,
      } as Prisma.InputJsonValue,
    },
  });
}

export interface RemediationUptakeStats {
  /** Deliveries that offered at least one lesson. */
  deliveriesWithRemediation: number;
  /** Of those, how many had at least one lesson opened. */
  deliveriesActedOn: number;
  /** deliveriesActedOn / deliveriesWithRemediation, or null when nothing offered. */
  uptakeRate: number | null;
}

/**
 * Headline uptake figure for a course. Counts deliveries, not clicks: a learner
 * who opens the same lesson five times acted on one piece of feedback.
 */
export async function getRemediationUptake(
  courseId: string,
  db: PrismaClient = prisma,
): Promise<RemediationUptakeStats> {
  const events = await db.learningEvent.findMany({
    where: {
      courseId,
      eventType: LearningEventType.FeedbackRemediationClicked,
    },
    select: { payload: true },
  });
  const actedDeliveryIds = new Set(
    events.flatMap((e) => {
      const p = e.payload as { deliveryId?: string } | null;
      return p?.deliveryId ? [p.deliveryId] : [];
    }),
  );

  // FeedbackDelivery.attemptId is a plain column with no relation, so the
  // course filter goes through the attempts rather than a join.
  const attempts = await db.quizAttempt.findMany({
    where: { quiz: { courseId } },
    select: { id: true },
  });
  if (attempts.length === 0) {
    return { deliveriesWithRemediation: 0, deliveriesActedOn: 0, uptakeRate: null };
  }
  const deliveries = await db.feedbackDelivery.findMany({
    where: { attemptId: { in: attempts.map((a) => a.id) } },
    select: { id: true, remediationLessonIds: true },
  });
  const withRemediation = deliveries.filter(
    (d) => Array.isArray(d.remediationLessonIds) && d.remediationLessonIds.length > 0,
  );
  const actedOn = withRemediation.filter((d) => actedDeliveryIds.has(d.id)).length;

  return {
    deliveriesWithRemediation: withRemediation.length,
    deliveriesActedOn: actedOn,
    uptakeRate:
      withRemediation.length === 0 ? null : actedOn / withRemediation.length,
  };
}
