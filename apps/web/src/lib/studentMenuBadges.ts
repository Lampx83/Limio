import { prisma } from "@feedbackme/db";

export type MenuBadge = { count: number; tone?: "warn" | "danger" };

export async function getStudentMenuBadges(
  userId: string | undefined,
): Promise<Record<string, MenuBadge>> {
  if (!userId) return {};

  const now = new Date();
  const [pending, overdue] = await Promise.all([
    prisma.missionReviewAssignment.count({
      where: { reviewerId: userId, completedAt: null },
    }),
    prisma.missionReviewAssignment.count({
      where: { reviewerId: userId, completedAt: null, dueAt: { lt: now } },
    }),
  ]);

  if (pending === 0) return {};
  return {
    "/me/reviews": {
      count: pending,
      tone: overdue > 0 ? "danger" : "warn",
    },
  };
}
