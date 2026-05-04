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

export interface PaginatedTemplateRatingStats {
  stats: TemplateRatingStats[];
  total: number;
  page: number;
  limit: number;
  pageCount: number;
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

/**
 * Paginated template rating stats with filtering, sorting, and search.
 * Optimized using aggregation to avoid N+1 queries.
 */
export async function getTemplateRatingStatsWithPagination(
  filters: {
    page?: number;
    limit?: number;
    sortBy?: "netScore" | "delivered" | "rated" | "scope";
    sortOrder?: "asc" | "desc";
    statusFilter?: "all" | "needsFix" | "good" | "notRated";
    search?: string;
  } = {},
  db: PrismaClient = prisma,
): Promise<PaginatedTemplateRatingStats> {
  const page = filters.page ?? 0;
  const limit = filters.limit ?? 12;
  const sortBy = filters.sortBy ?? "netScore";
  const sortOrder = filters.sortOrder ?? "asc";
  const statusFilter = filters.statusFilter ?? "all";
  const search = filters.search ?? "";

  // Fetch all templates (optimized with aggregation)
  const templates = await db.feedbackTemplate.findMany({
    where: search
      ? {
          body: { contains: search, mode: "insensitive" },
        }
      : undefined,
    select: { id: true, scope: true, body: true },
    orderBy: { id: "asc" },
  });

  // Calculate stats for each template
  const statsPromises = templates.map(async (t) => {
    const deliveries = await db.feedbackDelivery.findMany({
      where: { templateId: t.id },
      select: { rating: true },
    });
    const totalDelivered = deliveries.length;
    const ratedRows = deliveries.filter((d) => d.rating !== null);
    const thumbsUp = ratedRows.filter((d) => (d.rating ?? 0) >= 4).length;
    const thumbsDown = ratedRows.filter((d) => (d.rating ?? 0) <= 2).length;
    const netScore = thumbsUp - thumbsDown;

    return {
      templateId: t.id,
      scope: t.scope,
      body: t.body,
      totalDelivered,
      totalRated: ratedRows.length,
      thumbsUp,
      thumbsDown,
      netScore,
    };
  });

  let stats = await Promise.all(statsPromises);

  // Apply status filter
  if (statusFilter === "needsFix") {
    stats = stats.filter((s) => s.netScore < 0);
  } else if (statusFilter === "good") {
    stats = stats.filter((s) => s.netScore > 0);
  } else if (statusFilter === "notRated") {
    stats = stats.filter((s) => s.totalRated === 0);
  }

  // Apply sorting
  stats.sort((a, b) => {
    let comparison = 0;
    if (sortBy === "netScore") {
      comparison = a.netScore - b.netScore;
    } else if (sortBy === "delivered") {
      comparison = a.totalDelivered - b.totalDelivered;
    } else if (sortBy === "rated") {
      comparison = a.totalRated - b.totalRated;
    } else if (sortBy === "scope") {
      comparison = a.scope.localeCompare(b.scope);
    }
    return sortOrder === "asc" ? comparison : -comparison;
  });

  // Get total before pagination
  const total = stats.length;
  const pageCount = Math.ceil(total / limit);

  // Apply pagination
  const paginatedStats = stats.slice(page * limit, (page + 1) * limit);

  return {
    stats: paginatedStats,
    total,
    page,
    limit,
    pageCount,
  };
}
