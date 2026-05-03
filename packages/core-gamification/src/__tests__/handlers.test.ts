import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { onLessonCompleted, onQuizSubmitted } from "../handlers";

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
  it("AC-C1.2: first pass + difficulty 2 → 100 XP", async () => {
    const { userId, courseId } = await makeUserCourse();
    const r = await onQuizSubmitted({
      userId, courseId, attemptId: "A1", quizId: "Q1",
      passed: true, difficulty: 2, isFirstPass: true, elapsedSec: 60, scorePct: 80,
    });
    expect(r.xp?.amountGranted).toBe(100); // 50 × 2
  });

  it("AC-C1.3: retry pass + difficulty 2 → 40 XP", async () => {
    const { userId, courseId } = await makeUserCourse();
    const r = await onQuizSubmitted({
      userId, courseId, attemptId: "A2", quizId: "Q1",
      passed: true, difficulty: 2, isFirstPass: false, elapsedSec: 60, scorePct: 80,
    });
    expect(r.xp?.amountGranted).toBe(40); // 20 × 2
  });

  it("AC-C1.4: failed quiz returns null XP (no XP)", async () => {
    const { userId, courseId } = await makeUserCourse();
    const r = await onQuizSubmitted({
      userId, courseId, attemptId: "A3", quizId: "Q1",
      passed: false, difficulty: 1, isFirstPass: false, elapsedSec: 60, scorePct: 40,
    });
    expect(r.xp).toBeNull();
  });

  it("AC-C1.5 (anti-farm): elapsed < 10s → 0 XP, audit row stored", async () => {
    const { userId, courseId } = await makeUserCourse();
    const r = await onQuizSubmitted({
      userId, courseId, attemptId: "A4", quizId: "Q1",
      passed: true, difficulty: 1, isFirstPass: true, elapsedSec: 5, scorePct: 80,
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
      passed: true, difficulty: null, isFirstPass: true, elapsedSec: 60, scorePct: 80,
    });
    expect(r.xp?.amountGranted).toBe(50);
  });
});
