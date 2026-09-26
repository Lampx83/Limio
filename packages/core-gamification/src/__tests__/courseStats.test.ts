import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { ensureMilestoneBadges } from "../badges";
import {
  getCourseGamificationStats,
  getRecentXpTransactions,
} from "../courseStats";

const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function newUser(over: { leaderboardOptOut?: boolean; name?: string } = {}) {
  return prisma.user.create({
    data: {
      email: `cs-${uniq()}@e.com`,
      passwordHash: "x",
      displayName: over.name ?? "U",
      leaderboardOptOut: over.leaderboardOptOut ?? false,
    },
  });
}

async function newCourseWithSections() {
  const course = await prisma.course.create({
    data: { slug: `c-${uniq()}`, title: "C", description: "x" },
  });
  const def = await prisma.courseSection.create({
    data: { courseId: course.id, name: "Mặc định", isDefault: true },
  });
  const lopA = await prisma.courseSection.create({
    data: { courseId: course.id, name: "Lớp A" },
  });
  return { courseId: course.id, defaultId: def.id, lopAId: lopA.id };
}

async function enroll(userId: string, courseId: string, sectionId: string) {
  await prisma.enrollment.create({
    data: { userId, courseId, sectionId, courseVersion: 1 },
  });
}

describe("getCourseGamificationStats", () => {
  it("khoá chưa từng cấp XP → hasData=false, học viên vẫn liệt kê với 0 XP", async () => {
    const { courseId, defaultId } = await newCourseWithSections();
    const u = await newUser();
    await enroll(u.id, courseId, defaultId);

    const s = await getCourseGamificationStats({ courseId });
    expect(s.hasData).toBe(false);
    expect(s.rows).toHaveLength(1);
    expect(s.rows[0]).toMatchObject({ xp: 0, level: 1, currentStreak: 0 });
    expect(s.rows[0]!.badges).toEqual([]);
  });

  it("có XP → hasData, đủ N dòng kể cả người 0 XP, sắp XP giảm dần, tổng hợp đúng", async () => {
    const { courseId, defaultId } = await newCourseWithSections();
    const [a, b, c] = [await newUser(), await newUser(), await newUser()];
    for (const u of [a, b, c]) await enroll(u.id, courseId, defaultId);
    await prisma.userCourseProgress.create({
      data: { userId: a.id, courseId, xp: 100, level: 2 },
    });
    await prisma.userCourseProgress.create({
      data: { userId: b.id, courseId, xp: 50, level: 1 },
    });
    await prisma.streakRecord.create({
      data: { userId: a.id, courseId, currentStreak: 3, longestStreak: 5 },
    });

    const s = await getCourseGamificationStats({ courseId });
    expect(s.hasData).toBe(true);
    expect(s.rows.map((r) => r.userId)).toEqual([a.id, b.id, c.id]);
    expect(s.summary).toMatchObject({
      learnerCount: 3,
      totalXp: 150,
      avgXp: 50,
      activeStreakCount: 1,
      totalBadges: 0,
    });
    expect(s.summary.levelDistribution).toEqual({ 1: 2, 2: 1 });
    expect(s.rows[0]).toMatchObject({ currentStreak: 3, longestStreak: 5 });
  });

  it("badge chỉ tính khi context.courseId khớp khoá này", async () => {
    await ensureMilestoneBadges();
    const { courseId, defaultId } = await newCourseWithSections();
    const other = await newCourseWithSections();
    const u = await newUser();
    await enroll(u.id, courseId, defaultId);
    const [b1, b2, b3] = await prisma.badge.findMany({ take: 3 });

    await prisma.userBadge.create({
      data: { userId: u.id, badgeId: b1!.id, context: { courseId } },
    });
    await prisma.userBadge.create({
      data: { userId: u.id, badgeId: b2!.id, context: { courseId: other.courseId } },
    });
    await prisma.userBadge.create({ data: { userId: u.id, badgeId: b3!.id } });

    const s = await getCourseGamificationStats({ courseId });
    expect(s.rows[0]!.badges.map((x) => x.code)).toEqual([b1!.code]);
    expect(s.rows[0]!.badges[0]).toMatchObject({
      name: b1!.name,
      emoji: b1!.emoji,
      description: b1!.description,
      category: b1!.category,
    });
    expect(s.summary.totalBadges).toBe(1);
  });

  it("học viên opt-out leaderboard vẫn hiện, kèm cờ", async () => {
    const { courseId, defaultId } = await newCourseWithSections();
    const u = await newUser({ leaderboardOptOut: true });
    await enroll(u.id, courseId, defaultId);
    await prisma.userCourseProgress.create({
      data: { userId: u.id, courseId, xp: 10, level: 1 },
    });

    const s = await getCourseGamificationStats({ courseId });
    expect(s.rows).toHaveLength(1);
    expect(s.rows[0]!.leaderboardOptOut).toBe(true);
    expect(s.rows[0]!.xp).toBe(10);
  });

  it("lọc theo lớp: theo enrollment.sectionId hoặc CohortMember; hasData không đổi", async () => {
    const { courseId, defaultId, lopAId } = await newCourseWithSections();
    const inA = await newUser();
    const memberOnly = await newUser();
    const outside = await newUser();
    await enroll(inA.id, courseId, lopAId);
    await enroll(memberOnly.id, courseId, defaultId);
    await enroll(outside.id, courseId, defaultId);
    await prisma.cohortMember.create({
      data: { cohortId: lopAId, userId: memberOnly.id },
    });
    await prisma.userCourseProgress.create({
      data: { userId: outside.id, courseId, xp: 999, level: 5 },
    });

    const s = await getCourseGamificationStats({ courseId, sectionId: lopAId });
    expect(s.rows.map((r) => r.userId).sort()).toEqual(
      [inA.id, memberOnly.id].sort(),
    );
    expect(s.summary.totalXp).toBe(0);
    expect(s.hasData).toBe(true);
    // Tên lớp: lớp mặc định bị ẩn, lớp thường hiện.
    expect(s.rows.find((r) => r.userId === inA.id)!.sectionName).toBe("Lớp A");
    expect(s.rows.find((r) => r.userId === memberOnly.id)!.sectionName).toBeNull();
  });

  it("không lẫn dữ liệu khoá khác", async () => {
    const a = await newCourseWithSections();
    const b = await newCourseWithSections();
    const u = await newUser();
    await enroll(u.id, a.courseId, a.defaultId);
    await enroll(u.id, b.courseId, b.defaultId);
    await prisma.userCourseProgress.create({
      data: { userId: u.id, courseId: b.courseId, xp: 77, level: 3 },
    });

    const s = await getCourseGamificationStats({ courseId: a.courseId });
    expect(s.hasData).toBe(false);
    expect(s.rows[0]!.xp).toBe(0);
  });
});

describe("getRecentXpTransactions", () => {
  it("trả tối đa limit giao dịch, mới nhất trước, đúng khoá + user", async () => {
    const { courseId } = await newCourseWithSections();
    const u = await newUser();
    for (let i = 0; i < 5; i++) {
      await prisma.xpTransaction.create({
        data: {
          userId: u.id,
          courseId,
          amount: i,
          reason: "lesson.completed",
          sourceId: `l${i}`,
          occurredAt: new Date(2026, 0, 1 + i),
        },
      });
    }
    const rows = await getRecentXpTransactions(courseId, u.id, 3);
    expect(rows.map((r) => r.amount)).toEqual([4, 3, 2]);
  });
});
