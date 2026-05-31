import { unstable_cache } from "next/cache";
import { prisma } from "@feedbackme/db";

export type MenuBadge = { count: number; tone?: "warn" | "danger" };

// Badge cho menu học viên chạy trên MỌI navigation trong /me, /catalog,
// /tournaments, /leaderboard, /learn. Cache 20s per userId để giảm 2 query
// Prisma mỗi click. 20s là trade-off: đủ ngắn để badge cập nhật gần
// real-time sau khi user submit peer review, đủ dài để cache hit khi user
// click nhanh giữa các trang.
const _getStudentMenuBadgesCached = unstable_cache(
  async (userId: string) => {
    const now = new Date();
    const [pending, overdue] = await Promise.all([
      prisma.missionReviewAssignment.count({
        where: { reviewerId: userId, completedAt: null },
      }),
      prisma.missionReviewAssignment.count({
        where: { reviewerId: userId, completedAt: null, dueAt: { lt: now } },
      }),
    ]);
    if (pending === 0) return {} as Record<string, MenuBadge>;
    return {
      "/me/reviews": {
        count: pending,
        tone: overdue > 0 ? "danger" : "warn",
      },
    } as Record<string, MenuBadge>;
  },
  ["student-menu-badges"],
  { revalidate: 20, tags: ["student-menu-badges"] },
);

export async function getStudentMenuBadges(
  userId: string | undefined,
): Promise<Record<string, MenuBadge>> {
  if (!userId) return {};
  return _getStudentMenuBadgesCached(userId);
}

export type MenuContinue = { href: string; title: string };

// "Tiếp tục học" target cho sidemenu: enrollment đang học (status=active) gần
// nhất có lastLessonId. Dùng index [userId, status] + take 1 → rẻ. Cache 20s
// vì lastLessonId thay đổi khi học viên di chuyển giữa các bài (giống badges).
const _getStudentMenuContinueCached = unstable_cache(
  async (userId: string): Promise<MenuContinue | null> => {
    const e = await prisma.enrollment.findFirst({
      where: { userId, status: "active", lastLessonId: { not: null } },
      orderBy: { enrolledAt: "desc" },
      select: { lastLessonId: true, course: { select: { slug: true, title: true } } },
    });
    if (!e?.lastLessonId) return null;
    return {
      href: `/learn/${e.course.slug}/lessons/${e.lastLessonId}`,
      title: e.course.title,
    };
  },
  ["student-menu-continue"],
  { revalidate: 20, tags: ["student-menu-continue"] },
);

export async function getStudentMenuContinue(
  userId: string | undefined,
): Promise<MenuContinue | null> {
  if (!userId) return null;
  return _getStudentMenuContinueCached(userId);
}
