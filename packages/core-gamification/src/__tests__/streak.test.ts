import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { getStreak, recordActivity } from "../streak";

async function makeUserCourse() {
  const user = await prisma.user.create({
    data: {
      email: `s-${Date.now()}-${Math.random()}@e.com`,
      passwordHash: "x",
      displayName: "U",
    },
  });
  const course = await prisma.course.create({
    data: {
      slug: `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: "C",
      description: "x",
    },
  });
  return { userId: user.id, courseId: course.id };
}

function dayUtc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

describe("recordActivity", () => {
  it("AC-C4.1: first activity creates record with current=1, longest=1", async () => {
    const { userId, courseId } = await makeUserCourse();
    const r = await recordActivity(userId, courseId);
    expect(r.currentStreak).toBe(1);
    expect(r.longestStreak).toBe(1);
    expect(r.extended).toBe(true);
    expect(r.broken).toBe(false);

    const events = await prisma.learningEvent.findMany({
      where: { userId, eventType: LearningEventType.StreakExtended },
    });
    expect(events).toHaveLength(1);
    expect((events[0]!.payload as { newStreak: number }).newStreak).toBe(1);
  });

  it("AC-C4.2: same day activity → no change", async () => {
    const { userId, courseId } = await makeUserCourse();
    const day1 = dayUtc(2026, 5, 10);
    await recordActivity(userId, courseId, prisma, day1);
    const r = await recordActivity(userId, courseId, prisma, day1);
    expect(r.currentStreak).toBe(1);
    expect(r.extended).toBe(false);
    expect(r.broken).toBe(false);
  });

  it("AC-C4.3: consecutive days → current bumps, longest tracks max", async () => {
    const { userId, courseId } = await makeUserCourse();
    const r1 = await recordActivity(userId, courseId, prisma, dayUtc(2026, 5, 10));
    const r2 = await recordActivity(userId, courseId, prisma, dayUtc(2026, 5, 11));
    const r3 = await recordActivity(userId, courseId, prisma, dayUtc(2026, 5, 12));
    expect(r1.currentStreak).toBe(1);
    expect(r2.currentStreak).toBe(2);
    expect(r3.currentStreak).toBe(3);
    expect(r3.longestStreak).toBe(3);
  });

  it("AC-C4.4: gap ≥ 2 days → emits streak.broken, resets to 1; longest unchanged", async () => {
    const { userId, courseId } = await makeUserCourse();
    await recordActivity(userId, courseId, prisma, dayUtc(2026, 5, 10));
    await recordActivity(userId, courseId, prisma, dayUtc(2026, 5, 11));
    await recordActivity(userId, courseId, prisma, dayUtc(2026, 5, 12)); // 3-day streak
    const r = await recordActivity(userId, courseId, prisma, dayUtc(2026, 5, 16)); // 4-day gap
    expect(r.broken).toBe(true);
    expect(r.previousStreak).toBe(3);
    expect(r.currentStreak).toBe(1);
    expect(r.longestStreak).toBe(3); // preserved

    const broken = await prisma.learningEvent.findMany({
      where: { userId, eventType: LearningEventType.StreakBroken },
    });
    expect(broken).toHaveLength(1);
    expect((broken[0]!.payload as { previousStreak: number }).previousStreak).toBe(3);
  });

  it("AC-C4.5: per-course isolation", async () => {
    const userId = (await makeUserCourse()).userId;
    const courseA = (await makeUserCourse()).courseId;
    const courseB = (await makeUserCourse()).courseId;

    await recordActivity(userId, courseA, prisma, dayUtc(2026, 5, 10));
    await recordActivity(userId, courseA, prisma, dayUtc(2026, 5, 11));
    const a = await getStreak(userId, courseA, prisma, dayUtc(2026, 5, 11));
    const b = await getStreak(userId, courseB, prisma, dayUtc(2026, 5, 11));
    expect(a.currentStreak).toBe(2);
    expect(b.currentStreak).toBe(0);
  });

  it("AC-C4.6: streak.extended emitted on every increase, including reset (1)", async () => {
    const { userId, courseId } = await makeUserCourse();
    await recordActivity(userId, courseId, prisma, dayUtc(2026, 5, 10));
    await recordActivity(userId, courseId, prisma, dayUtc(2026, 5, 11));
    await recordActivity(userId, courseId, prisma, dayUtc(2026, 5, 14)); // gap, reset
    const events = await prisma.learningEvent.findMany({
      where: { userId, eventType: LearningEventType.StreakExtended },
      orderBy: { occurredAt: "asc" },
    });
    expect(events).toHaveLength(3); // initial 1, bump to 2, reset to 1
    expect(events.map((e) => (e.payload as { newStreak: number }).newStreak)).toEqual([
      1, 2, 1,
    ]);
  });

  it("AC-C4.7: getStreak returns full info; isActiveToday correct", async () => {
    const { userId, courseId } = await makeUserCourse();
    await recordActivity(userId, courseId, prisma, dayUtc(2026, 5, 10));

    const today = await getStreak(userId, courseId, prisma, dayUtc(2026, 5, 10));
    expect(today.currentStreak).toBe(1);
    expect(today.isActiveToday).toBe(true);

    const tomorrow = await getStreak(userId, courseId, prisma, dayUtc(2026, 5, 11));
    expect(tomorrow.isActiveToday).toBe(false);
  });

  it("AC-C4.8: day boundary is VN-local, not UTC — two instants on the same VN day but different UTC days = no change", async () => {
    const { userId, courseId } = await makeUserCourse();
    // 2026-05-10T18:00Z = 2026-05-11 01:00 VN
    const a = new Date(Date.UTC(2026, 4, 10, 18, 0, 0));
    // 2026-05-11T02:00Z = 2026-05-11 09:00 VN — SAME VN day, NEXT UTC day
    const b = new Date(Date.UTC(2026, 4, 11, 2, 0, 0));
    await recordActivity(userId, courseId, prisma, a);
    const r = await recordActivity(userId, courseId, prisma, b);
    // Under the old UTC logic this would bump to 2; under VN-local it stays 1.
    expect(r.currentStreak).toBe(1);
    expect(r.extended).toBe(false);
  });

  it("getStreak returns zeros for users with no record", async () => {
    const { userId, courseId } = await makeUserCourse();
    const s = await getStreak(userId, courseId);
    expect(s.currentStreak).toBe(0);
    expect(s.longestStreak).toBe(0);
    expect(s.lastActiveDate).toBeNull();
    expect(s.isActiveToday).toBe(false);
  });
});
