import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import {
  checkCourseCompletedBadges,
  checkLessonCompletedBadges,
  checkQuizStartedBadges,
  checkQuizSubmittedBadges,
  ensureMilestoneBadges,
  listBadgeCatalog,
  listUserBadges,
  MILESTONE_BADGES,
} from "../badges";
import { onLessonCompleted, onQuizStarted, onQuizSubmitted } from "../handlers";

async function newUser(): Promise<string> {
  const u = await prisma.user.create({
    data: {
      email: `b-${Date.now()}-${Math.random()}@e.com`,
      passwordHash: "x",
      displayName: "U",
    },
  });
  return u.id;
}

async function newCourse(): Promise<string> {
  const c = await prisma.course.create({
    data: {
      slug: `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: "C",
      description: "x",
    },
  });
  return c.id;
}

beforeEach(async () => {
  await ensureMilestoneBadges();
});

describe("ensureMilestoneBadges (AC-C3.1)", () => {
  it("seeds 5 milestone badges; idempotent", async () => {
    const c1 = await listBadgeCatalog();
    expect(c1).toHaveLength(MILESTONE_BADGES.length);
    expect(c1.map((b) => b.code).sort()).toEqual(
      MILESTONE_BADGES.map((b) => b.code).sort(),
    );
    // Re-run — should still be 5.
    await ensureMilestoneBadges();
    const c2 = await listBadgeCatalog();
    expect(c2).toHaveLength(MILESTONE_BADGES.length);
  });
});

describe("checkLessonCompletedBadges (AC-C3.2)", () => {
  it("awards first_step on first call; idempotent on second", async () => {
    const userId = await newUser();
    const courseId = await newCourse();
    const r1 = await checkLessonCompletedBadges({ userId, courseId, lessonId: "L1" });
    expect(r1.awarded).toHaveLength(1);
    expect(r1.awarded[0]!.badgeCode).toBe("first_step");
    const r2 = await checkLessonCompletedBadges({ userId, courseId, lessonId: "L2" });
    expect(r2.awarded).toHaveLength(0);
  });

  it("AC-C3.8: emits badge.earned event", async () => {
    const userId = await newUser();
    const courseId = await newCourse();
    await checkLessonCompletedBadges({ userId, courseId, lessonId: "L1" });
    const events = await prisma.learningEvent.findMany({
      where: { userId, eventType: LearningEventType.BadgeEarned },
    });
    expect(events).toHaveLength(1);
    const payload = events[0]!.payload as Record<string, unknown>;
    expect(payload.badgeCode).toBe("first_step");
  });
});

describe("checkQuizStartedBadges (AC-C3.3)", () => {
  it("awards quiz_starter on first start", async () => {
    const userId = await newUser();
    const courseId = await newCourse();
    const r = await checkQuizStartedBadges({
      userId, courseId, quizId: "Q1", attemptId: "A1",
    });
    expect(r.awarded).toHaveLength(1);
  });
});

describe("checkQuizSubmittedBadges", () => {
  it("AC-C3.4: awards first_win on any submission", async () => {
    const userId = await newUser();
    const courseId = await newCourse();
    const r = await checkQuizSubmittedBadges({
      userId, courseId, quizId: "Q1", attemptId: "A1",
      scorePct: 80,
    });
    expect(r.awarded.map((a) => a.badgeCode)).toContain("first_win");
  });

  it("awards first_win even at a low score (no pass threshold)", async () => {
    const userId = await newUser();
    const courseId = await newCourse();
    const r = await checkQuizSubmittedBadges({
      userId, courseId, quizId: "Q1", attemptId: "A1",
      scorePct: 40,
    });
    expect(r.awarded.map((a) => a.badgeCode)).toContain("first_win");
  });

  it("AC-C3.5: awards perfect_score at 100%", async () => {
    const userId = await newUser();
    const courseId = await newCourse();
    const r = await checkQuizSubmittedBadges({
      userId, courseId, quizId: "Q1", attemptId: "A1",
      scorePct: 100,
    });
    expect(r.awarded.map((a) => a.badgeCode).sort()).toEqual(["first_win", "perfect_score"]);
  });

  it("does NOT award perfect_score under 100", async () => {
    const userId = await newUser();
    const courseId = await newCourse();
    const r = await checkQuizSubmittedBadges({
      userId, courseId, quizId: "Q1", attemptId: "A1",
      scorePct: 99.5,
    });
    expect(r.awarded.map((a) => a.badgeCode)).not.toContain("perfect_score");
  });
});

describe("checkCourseCompletedBadges (AC-C3.6)", () => {
  it("awards course_complete once", async () => {
    const userId = await newUser();
    const courseId = await newCourse();
    const r1 = await checkCourseCompletedBadges({ userId, courseId });
    const r2 = await checkCourseCompletedBadges({ userId, courseId });
    expect(r1.awarded).toHaveLength(1);
    expect(r2.awarded).toHaveLength(0);
  });
});

describe("listUserBadges (AC-C3.9)", () => {
  it("returns earned badges with badge join", async () => {
    const userId = await newUser();
    const courseId = await newCourse();
    await checkLessonCompletedBadges({ userId, courseId, lessonId: "L1" });
    await checkQuizStartedBadges({
      userId, courseId, quizId: "Q1", attemptId: "A1",
    });
    const list = await listUserBadges(userId);
    expect(list).toHaveLength(2);
    expect(list[0]!.badge.code).toBeTruthy();
  });
});

describe("integration via handlers", () => {
  it("onLessonCompleted awards XP + first_step badge", async () => {
    const userId = await newUser();
    const courseId = await newCourse();
    const r = await onLessonCompleted({ userId, courseId, lessonId: "L1" });
    expect(r.xp.amountGranted).toBe(10);
    expect(r.badges.awarded.map((a) => a.badgeCode)).toContain("first_step");
  });

  it("onQuizSubmitted with 100% awards XP + first_win + perfect_score", async () => {
    const userId = await newUser();
    const courseId = await newCourse();
    const r = await onQuizSubmitted({
      userId, courseId, attemptId: "A1", quizId: "Q1",
      difficulty: 1, isFirstPass: true, elapsedSec: 30, scorePct: 100,
    });
    expect(r.xp?.amountGranted).toBe(50);
    expect(r.badges.awarded.map((a) => a.badgeCode).sort()).toEqual([
      "first_win",
      "perfect_score",
    ]);
  });

  it("onQuizStarted awards quiz_starter", async () => {
    const userId = await newUser();
    const courseId = await newCourse();
    const r = await onQuizStarted({
      userId, courseId, quizId: "Q1", attemptId: "A1",
    });
    expect(r.badges.awarded.map((a) => a.badgeCode)).toContain("quiz_starter");
  });
});
