import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";

export class FeedbackRatingError extends Error {
  constructor(public readonly code: "delivery_not_found" | "forbidden" | "validation_failed") {
    super(code);
  }
}

/**
 * Learner rates a delivered feedback (B6 quality loop). Maps 👍 → 5, 👎 → 1.
 * Idempotent — re-rating updates the same row. Emits `feedback.rated` event.
 */
export async function rateFeedback(
  userId: string,
  deliveryId: string,
  rating: number,
  db: PrismaClient = prisma,
): Promise<void> {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new FeedbackRatingError("validation_failed");
  }
  const delivery = await db.feedbackDelivery.findUnique({
    where: { id: deliveryId },
    select: { id: true, userId: true, templateId: true },
  });
  if (!delivery) throw new FeedbackRatingError("delivery_not_found");
  if (delivery.userId !== userId) throw new FeedbackRatingError("forbidden");

  await db.feedbackDelivery.update({
    where: { id: deliveryId },
    data: { rating },
  });
  await db.learningEvent.create({
    data: {
      userId,
      eventType: LearningEventType.FeedbackRated,
      payload: {
        deliveryId,
        templateId: delivery.templateId,
        rating,
      } as Prisma.InputJsonValue,
    },
  });
}

export interface TemplateRatingStats {
  templateId: string;
  scope: string;
  body: string;
  totalDelivered: number;
  totalRated: number;
  thumbsUp: number;
  thumbsDown: number;
  netScore: number;
}

/**
 * Aggregated template ratings for instructor analytics. Counts ratings ≥ 4 as
 * thumbs-up, ≤ 2 as thumbs-down. Sorted by netScore asc — worst-performing
 * templates first so the instructor can prioritize fixes.
 */
export async function getTemplateRatingStats(
  db: PrismaClient = prisma,
): Promise<TemplateRatingStats[]> {
  const templates = await db.feedbackTemplate.findMany({
    select: { id: true, scope: true, body: true },
  });
  const stats: TemplateRatingStats[] = [];
  for (const t of templates) {
    const deliveries = await db.feedbackDelivery.findMany({
      where: { templateId: t.id },
      select: { rating: true },
    });
    const totalDelivered = deliveries.length;
    const ratedRows = deliveries.filter((d) => d.rating !== null);
    const thumbsUp = ratedRows.filter((d) => (d.rating ?? 0) >= 4).length;
    const thumbsDown = ratedRows.filter((d) => (d.rating ?? 0) <= 2).length;
    stats.push({
      templateId: t.id,
      scope: t.scope,
      body: t.body,
      totalDelivered,
      totalRated: ratedRows.length,
      thumbsUp,
      thumbsDown,
      netScore: thumbsUp - thumbsDown,
    });
  }
  stats.sort((a, b) => a.netScore - b.netScore);
  return stats;
}
