import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { onLessonCompleted, onLessonViewed, onQuizSubmitted } from "../handlers";

async function makeUserCourse() {
  const user = await prisma.user.create({
    data: {
      email: `h-${Date.now()}-${Math.random()}@e.com`,
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

describe("onLessonCompleted", () => {
  it("AC-C1.1: grants 10 XP per lesson", async () => {
    const { userId, courseId } = await makeUserCourse();
    const r = await onLessonCompleted({ userId, courseId, lessonId: "L1" });
    expect(r.xp.amountGranted).toBe(10);
    expect(r.xp.after.xp).toBe(10);
  });

  it("idempotent — same lessonId twice = no extra XP", async () => {
    const { userId, courseId } = await makeUserCourse();
    await onLessonCompleted({ userId, courseId, lessonId: "L1" });
    const second = await onLessonCompleted({ userId, courseId, lessonId: "L1" });
    expect(second.xp.awarded).toBe(false);
  });
});

describe("onQuizSubmitted", () => {
  it("AC-C1.2: first submit + difficulty 2 + 100% → 100 XP", async () => {
    const { userId, courseId } = await makeUserCourse();
    const r = await onQuizSubmitted({
      userId, courseId, attemptId: "A1", quizId: "Q1",
      difficulty: 2, isFirstPass: true, elapsedSec: 60, scorePct: 100,
    });
    expect(r.xp?.amountGranted).toBe(100); // 50 × 2 × 100%

  });

  it("XP scales with score: first submit + difficulty 2 + 80% → 80 XP", async () => {
    const { userId, courseId } = await makeUserCourse();
    const r = await onQuizSubmitted({
      userId, courseId, attemptId: "A1b", quizId: "Q1",
      difficulty: 2, isFirstPass: true, elapsedSec: 60, scorePct: 80,
    });
    expect(r.xp?.amountGranted).toBe(80); // 50 × 2 × 0.8
  });

  it("AC-C1.3: retry + difficulty 2 + 100% → 40 XP", async () => {
    const { userId, courseId } = await makeUserCourse();
    const r = await onQuizSubmitted({
      userId, courseId, attemptId: "A2", quizId: "Q1",
      difficulty: 2, isFirstPass: false, elapsedSec: 60, scorePct: 100,
    });
    expect(r.xp?.amountGranted).toBe(40); // 20 × 2 × 100%
  });

  it("AC-C1.4: low score still earns proportional XP (no pass threshold)", async () => {
    const { userId, courseId } = await makeUserCourse();
    const r = await onQuizSubmitted({
      userId, courseId, attemptId: "A3", quizId: "Q1",
      difficulty: 1, isFirstPass: false, elapsedSec: 60, scorePct: 40,
    });
    expect(r.xp?.amountGranted).toBe(8); // 20 × 1 × 0.4
  });

  it("0% score → no XP row at all", async () => {
    const { userId, courseId } = await makeUserCourse();
    const r = await onQuizSubmitted({
      userId, courseId, attemptId: "A3b", quizId: "Q1",
      difficulty: 1, isFirstPass: false, elapsedSec: 60, scorePct: 0,
    });
    expect(r.xp).toBeNull();
  });

  it("AC-C1.5 (anti-farm): elapsed < 10s → 0 XP, audit row stored", async () => {
    const { userId, courseId } = await makeUserCourse();
    const r = await onQuizSubmitted({
      userId, courseId, attemptId: "A4", quizId: "Q1",
      difficulty: 1, isFirstPass: true, elapsedSec: 5, scorePct: 80,
    });
    expect(r.xp?.amountGranted).toBe(0);
    const tx = await prisma.xpTransaction.findFirst({
      where: { userId, courseId, sourceId: { startsWith: "speed_run:" } },
    });
    expect(tx).not.toBeNull();
    expect(tx?.amount).toBe(0);
  });

  it("difficulty null defaults to 1 → 50 XP first pass", async () => {
    const { userId, courseId } = await makeUserCourse();
    const r = await onQuizSubmitted({
      userId, courseId, attemptId: "A5", quizId: "Q1",
      difficulty: null, isFirstPass: true, elapsedSec: 60, scorePct: 100,
    });
    expect(r.xp?.amountGranted).toBe(50);
  });
});

describe("onLessonViewed", () => {
  it("AC-C4.9: first view of the day extends the streak to 1, no XP", async () => {
    const { userId, courseId } = await makeUserCourse();
    const r = await onLessonViewed({ userId, courseId });
    expect(r.streak.currentStreak).toBe(1);
    expect(r.streak.extended).toBe(true);
    const xpTx = await prisma.xpTransaction.findFirst({ where: { userId, courseId } });
    expect(xpTx).toBeNull();
  });

  it("AC-C4.9: repeated same-day views (heartbeat) don't inflate the streak", async () => {
    const { userId, courseId } = await makeUserCourse();
    await onLessonViewed({ userId, courseId });
    const second = await onLessonViewed({ userId, courseId });
    const third = await onLessonViewed({ userId, courseId });
    expect(second.streak.currentStreak).toBe(1);
    expect(third.streak.currentStreak).toBe(1);
    expect(third.streak.extended).toBe(false);
  });

});
