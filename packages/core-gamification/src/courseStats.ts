import { prisma } from "@feedbackme/db";

/**
 * Thống kê gamification theo khoá cho giảng viên (chỉ đọc — không emit event).
 *
 * Hàm này KHÔNG kiểm quyền: caller (apps/web) phải `assertCanEditCourse` trước.
 * Dữ liệu này là hồ sơ học viên nên tuyệt đối không được lộ ra endpoint mở.
 */

export interface CourseGamificationBadge {
  code: string;
  name: string;
  emoji: string | null;
  description: string;
  category: string;
  earnedAt: Date;
}

export interface CourseGamificationRow {
  userId: string;
  displayName: string;
  email: string;
  sectionId: string | null;
  sectionName: string | null;
  xp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  badges: CourseGamificationBadge[];
  /** Học viên ẩn khỏi bảng xếp hạng công khai — GV vẫn thấy, UI phải gắn nhãn. */
  leaderboardOptOut: boolean;
}

export interface CourseGamificationSummary {
  learnerCount: number;
  totalXp: number;
  avgXp: number;
  /** level → số học viên. Chỉ chứa level có ít nhất 1 học viên. */
  levelDistribution: Record<number, number>;
  totalBadges: number;
  activeStreakCount: number;
}

export interface CourseGamificationStats {
  /**
   * Khoá đã từng cấp XP cho ai chưa (không phụ thuộc bộ lọc lớp). Course không
   * có cờ bật/tắt gamification, nên đây là tín hiệu duy nhất để phân biệt
   * "khoá chưa dùng gamification" với "lớp lọc ra rỗng".
   */
  hasData: boolean;
  summary: CourseGamificationSummary;
  rows: CourseGamificationRow[];
}

export interface GetCourseGamificationStatsInput {
  courseId: string;
  /** Lọc theo lớp: enrollment.sectionId HOẶC là thành viên lớp (CohortMember). */
  sectionId?: string | null;
}

export async function getCourseGamificationStats(
  input: GetCourseGamificationStatsInput,
): Promise<CourseGamificationStats> {
  const { courseId, sectionId } = input;

  const [anyProgress, anyTx] = await Promise.all([
    prisma.userCourseProgress.findFirst({
      where: { courseId },
      select: { id: true },
    }),
    prisma.xpTransaction.findFirst({
      where: { courseId },
      select: { id: true },
    }),
  ]);
  const hasData = anyProgress !== null || anyTx !== null;

  const enrollments = await prisma.enrollment.findMany({
    where: {
      courseId,
      ...(sectionId
        ? {
            OR: [
              { sectionId },
              { user: { cohortMemberships: { some: { cohortId: sectionId } } } },
            ],
          }
        : {}),
    },
    select: {
      userId: true,
      section: { select: { id: true, name: true, isDefault: true } },
      user: {
        select: { displayName: true, email: true, leaderboardOptOut: true },
      },
    },
  });
  const userIds = enrollments.map((e) => e.userId);

  const [progress, streaks, userBadges] = await Promise.all([
    prisma.userCourseProgress.findMany({
      where: { courseId, userId: { in: userIds } },
      select: { userId: true, xp: true, level: true },
    }),
    prisma.streakRecord.findMany({
      where: { courseId, userId: { in: userIds } },
      select: { userId: true, currentStreak: true, longestStreak: true },
    }),
    // Chỉ badge gắn khoá này (context.courseId) — badge không có context bị loại.
    prisma.userBadge.findMany({
      where: {
        userId: { in: userIds },
        context: { path: ["courseId"], equals: courseId },
      },
      select: {
        userId: true,
        earnedAt: true,
        badge: {
          select: {
            code: true,
            name: true,
            emoji: true,
            description: true,
            category: true,
          },
        },
      },
      orderBy: { earnedAt: "desc" },
    }),
  ]);

  const progressBy = new Map(progress.map((p) => [p.userId, p]));
  const streakBy = new Map(streaks.map((s) => [s.userId, s]));
  const badgesBy = new Map<string, CourseGamificationBadge[]>();
  for (const ub of userBadges) {
    const list = badgesBy.get(ub.userId) ?? [];
    list.push({
      code: ub.badge.code,
      name: ub.badge.name,
      emoji: ub.badge.emoji,
      description: ub.badge.description,
      category: ub.badge.category,
      earnedAt: ub.earnedAt,
    });
    badgesBy.set(ub.userId, list);
  }

  const rows: CourseGamificationRow[] = enrollments.map((e) => {
    const p = progressBy.get(e.userId);
    const s = streakBy.get(e.userId);
    return {
      userId: e.userId,
      displayName: e.user.displayName,
      email: e.user.email,
      // Lớp mặc định là chỗ rơi tự động, ẩn khỏi UI quản lý lớp → không hiện tên.
      sectionId: e.section.isDefault ? null : e.section.id,
      sectionName: e.section.isDefault ? null : e.section.name,
      xp: p?.xp ?? 0,
      level: p?.level ?? 1,
      currentStreak: s?.currentStreak ?? 0,
      longestStreak: s?.longestStreak ?? 0,
      badges: badgesBy.get(e.userId) ?? [],
      leaderboardOptOut: e.user.leaderboardOptOut,
    };
  });
  rows.sort((a, b) => b.xp - a.xp || a.displayName.localeCompare(b.displayName, "vi"));

  const totalXp = rows.reduce((sum, r) => sum + r.xp, 0);
  const levelDistribution: Record<number, number> = {};
  for (const r of rows) {
    levelDistribution[r.level] = (levelDistribution[r.level] ?? 0) + 1;
  }

  return {
    hasData,
    summary: {
      learnerCount: rows.length,
      totalXp,
      avgXp: rows.length === 0 ? 0 : Math.round(totalXp / rows.length),
      levelDistribution,
      totalBadges: rows.reduce((sum, r) => sum + r.badges.length, 0),
      activeStreakCount: rows.filter((r) => r.currentStreak > 0).length,
    },
    rows,
  };
}

export interface RecentXpTransaction {
  amount: number;
  reason: string;
  occurredAt: Date;
}

/** N giao dịch XP gần nhất của 1 học viên trong khoá (drill-down từ bảng). */
export async function getRecentXpTransactions(
  courseId: string,
  userId: string,
  limit = 20,
): Promise<RecentXpTransaction[]> {
  return prisma.xpTransaction.findMany({
    where: { courseId, userId },
    select: { amount: true, reason: true, occurredAt: true },
    orderBy: { occurredAt: "desc" },
    take: limit,
  });
}
