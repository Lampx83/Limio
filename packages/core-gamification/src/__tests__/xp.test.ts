import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { awardXp, getCourseXpProgress } from "../xp";

async function makeUserCourse() {
  const user = await prisma.user.create({
    data: {
      email: `u-${Date.now()}-${Math.random()}@e.com`,
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

describe("awardXp", () => {
  afterEach(() => vi.useRealTimers());

  it("AC-C1.1/8: awards XP, creates progress row, updates aggregate atomically", async () => {
    const { userId, courseId } = await makeUserCourse();
    const result = await awardXp({
      userId,
      courseId,
      amount: 10,
      reason: "lesson.completed",
      sourceId: "lesson-a",
    });
    expect(result.awarded).toBe(true);
    expect(result.amountGranted).toBe(10);
    expect(result.after.xp).toBe(10);
    expect(result.after.level).toBe(1);

    const row = await prisma.userCourseProgress.findUniqueOrThrow({
      where: { userId_courseId: { userId, courseId } },
    });
    expect(row.xp).toBe(10);

    const tx = await prisma.xpTransaction.findFirst({
      where: { userId, courseId, reason: "lesson.completed" },
    });
    expect(tx?.amount).toBe(10);
    expect(tx?.sourceId).toBe("lesson-a");
  });

  it("AC-C1.6: idempotent on (userId, reason, sourceId) — second award is no-op", async () => {
    const { userId, courseId } = await makeUserCourse();
    const a = await awardXp({
      userId, courseId, amount: 10, reason: "lesson.completed", sourceId: "L1",
    });
    const b = await awardXp({
      userId, courseId, amount: 10, reason: "lesson.completed", sourceId: "L1",
    });
    expect(a.awarded).toBe(true);
    expect(b.awarded).toBe(false);
    const row = await prisma.userCourseProgress.findUniqueOrThrow({
      where: { userId_courseId: { userId, courseId } },
    });
    expect(row.xp).toBe(10); // not 20
    const txs = await prisma.xpTransaction.findMany({ where: { userId, courseId } });
    expect(txs).toHaveLength(1);
  });

  it("emits xp.awarded event with payload", async () => {
    const { userId, courseId } = await makeUserCourse();
    await awardXp({
      userId, courseId, amount: 10, reason: "lesson.completed", sourceId: "L1",
    });
    const events = await prisma.learningEvent.findMany({
      where: { userId, eventType: LearningEventType.XpAwarded },
    });
    expect(events).toHaveLength(1);
    const payload = events[0]!.payload as Record<string, unknown>;
    expect(payload.amount).toBe(10);
    expect(payload.newXp).toBe(10);
  });

  it("AC-C1.10: emits level.up event when crossing threshold; idempotent per level", async () => {
    const { userId, courseId } = await makeUserCourse();
    // First grant: 10 XP, no level-up.
    await awardXp({ userId, courseId, amount: 10, reason: "lesson.completed", sourceId: "L1" });
    // Second grant of 200 XP — would cross threshold to level 2 (>=200).
    const r = await awardXp({
      userId, courseId, amount: 200, reason: "quiz.passed.first_try", sourceId: "Q1",
    });
    expect(r.leveledUp).toBe(true);
    expect(r.before.level).toBe(1);
    expect(r.after.level).toBe(2);

    const lvlUps = await prisma.learningEvent.findMany({
      where: { userId, eventType: LearningEventType.LevelUp },
    });
    expect(lvlUps).toHaveLength(1);
    expect((lvlUps[0]!.payload as Record<string, unknown>).toLevel).toBe(2);

    // Replay-safe: another XP grant that doesn't cross another threshold doesn't re-emit level.up.
    await awardXp({
      userId, courseId, amount: 50, reason: "quiz.passed.retry", sourceId: "Q2",
    });
    const stillOne = await prisma.learningEvent.findMany({
      where: { userId, eventType: LearningEventType.LevelUp },
    });
    expect(stillOne).toHaveLength(1);
  });

  it("AC-C1.7: daily cap — 11th lesson XP records 0-amount with reason xp.capped.daily", async () => {
    const { userId, courseId } = await makeUserCourse();
    for (let i = 0; i < 10; i++) {
      const r = await awardXp({
        userId, courseId, amount: 10, reason: "lesson.completed", sourceId: `L-${i}`,
      });
      expect(r.amountGranted).toBe(10);
    }
    const eleventh = await awardXp({
      userId, courseId, amount: 10, reason: "lesson.completed", sourceId: "L-10",
    });
    expect(eleventh.amountGranted).toBe(0);
    expect(eleventh.storedReason).toBe("xp.capped.daily");

    const row = await prisma.userCourseProgress.findUniqueOrThrow({
      where: { userId_courseId: { userId, courseId } },
    });
    expect(row.xp).toBe(100); // 10 × 10, the 11th was capped
  });

  it("yesterday's grants don't count toward today's cap", async () => {
    const { userId, courseId } = await makeUserCourse();
    // Insert 10 ledger rows directly, dated yesterday.
    const yesterday = new Date(Date.now() - 26 * 60 * 60 * 1000);
    for (let i = 0; i < 10; i++) {
      await prisma.xpTransaction.create({
        data: {
          userId, courseId, amount: 10,
          reason: "lesson.completed", sourceId: `Y-${i}`,
          occurredAt: yesterday,
        },
      });
    }
    // Today's first lesson XP should still go through.
    const r = await awardXp({
      userId, courseId, amount: 10, reason: "lesson.completed", sourceId: "Today-1",
    });
    expect(r.amountGranted).toBe(10);
  });

  it("getCourseXpProgress returns level + bracket math", async () => {
    const { userId, courseId } = await makeUserCourse();
    await awardXp({
      userId, courseId, amount: 350, reason: "quiz.passed.first_try", sourceId: "Q1",
    });
    const p = await getCourseXpProgress(userId, courseId);
    expect(p.level).toBe(2);
    expect(p.levelName).toBe("Engaged");
    expect(p.xp).toBe(350);
    expect(p.nextLevelXp).toBe(500);
    expect(p.xpToNext).toBe(150);
    // 350 - 200 (level 2 start) over 500 - 200 (range) = 50%
    expect(p.levelProgressPct).toBe(50);
  });

  it("getCourseXpProgress returns level 1 / 0 XP for users with no grants yet", async () => {
    const { userId, courseId } = await makeUserCourse();
    const p = await getCourseXpProgress(userId, courseId);
    expect(p.level).toBe(1);
    expect(p.xp).toBe(0);
    expect(p.levelProgressPct).toBe(0);
    expect(p.isMaxLevel).toBe(false);
  });

  it("at MAX_LEVEL: xpToNext null, levelProgressPct 100", async () => {
    const { userId, courseId } = await makeUserCourse();
    await awardXp({
      userId, courseId, amount: 4000, reason: "quiz.passed.first_try", sourceId: "Q1",
    });
    const p = await getCourseXpProgress(userId, courseId);
    expect(p.isMaxLevel).toBe(true);
    expect(p.xpToNext).toBeNull();
    expect(p.levelProgressPct).toBe(100);
  });
});
