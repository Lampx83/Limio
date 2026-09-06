import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import {
  RemediationClickError,
  getRemediationUptake,
  recordRemediationClick,
} from "../uptake";

interface Setup {
  userId: string;
  otherUserId: string;
  courseId: string;
  lessonId: string;
  otherLessonId: string;
  deliveryId: string;
  attemptId: string;
}

async function setup(slug: string): Promise<Setup> {
  const user = await prisma.user.create({
    data: { email: `up-${slug}@e.com`, passwordHash: "x", displayName: slug },
  });
  const other = await prisma.user.create({
    data: { email: `up-other-${slug}@e.com`, passwordHash: "x", displayName: "other" },
  });
  const course = await prisma.course.create({
    data: { slug: `c-up-${slug}`, title: "C", description: "x" },
  });
  const mod = await prisma.module.create({
    data: { courseId: course.id, title: "M", orderIndex: 0 },
  });
  const lesson = await prisma.lesson.create({
    data: { moduleId: mod.id, title: "Offered", orderIndex: 0 },
  });
  const otherLesson = await prisma.lesson.create({
    data: { moduleId: mod.id, title: "Not offered", orderIndex: 1 },
  });
  const quiz = await prisma.quiz.create({
    data: { courseId: course.id, title: "Q" },
  });
  const question = await prisma.quizQuestion.create({
    data: { quizId: quiz.id, type: "mcq", prompt: "p", orderIndex: 0 },
  });
  const attempt = await prisma.quizAttempt.create({
    data: { quizId: quiz.id, userId: user.id, status: "submitted" },
  });
  const delivery = await prisma.feedbackDelivery.create({
    data: {
      userId: user.id,
      attemptId: attempt.id,
      questionId: question.id,
      body: "x",
      remediationLessonIds: [lesson.id],
    },
  });
  return {
    userId: user.id,
    otherUserId: other.id,
    courseId: course.id,
    lessonId: lesson.id,
    otherLessonId: otherLesson.id,
    deliveryId: delivery.id,
    attemptId: attempt.id,
  };
}

describe("recordRemediationClick", () => {
  it("AC-4.1: emits feedback.remediation.clicked with the identifying payload", async () => {
    const s = await setup("happy");

    await recordRemediationClick(s.userId, s.deliveryId, s.lessonId);

    const ev = await prisma.learningEvent.findFirstOrThrow({
      where: {
        userId: s.userId,
        eventType: LearningEventType.FeedbackRemediationClicked,
      },
    });
    expect(ev.courseId).toBe(s.courseId);
    expect(ev.payload).toMatchObject({
      deliveryId: s.deliveryId,
      lessonId: s.lessonId,
      attemptId: s.attemptId,
    });
  });

  it("AC-4.3: refuses a lesson this delivery never offered", async () => {
    const s = await setup("notoffered");
    await expect(
      recordRemediationClick(s.userId, s.deliveryId, s.otherLessonId),
    ).rejects.toMatchObject({ code: "lesson_not_offered" });
    expect(
      await prisma.learningEvent.count({
        where: { eventType: LearningEventType.FeedbackRemediationClicked, userId: s.userId },
      }),
    ).toBe(0);
  });

  it("AC-4.4: refuses another learner's delivery", async () => {
    const s = await setup("forbidden");
    await expect(
      recordRemediationClick(s.otherUserId, s.deliveryId, s.lessonId),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("unknown delivery throws delivery_not_found", async () => {
    const s = await setup("missing");
    await expect(
      recordRemediationClick(
        s.userId,
        "00000000-0000-0000-0000-000000000000",
        s.lessonId,
      ),
    ).rejects.toBeInstanceOf(RemediationClickError);
  });

  it("AC-4.5: repeat clicks append rather than dedupe", async () => {
    const s = await setup("repeat");
    await recordRemediationClick(s.userId, s.deliveryId, s.lessonId);
    await recordRemediationClick(s.userId, s.deliveryId, s.lessonId);
    expect(
      await prisma.learningEvent.count({
        where: {
          userId: s.userId,
          eventType: LearningEventType.FeedbackRemediationClicked,
        },
      }),
    ).toBe(2);
  });
});

describe("getRemediationUptake", () => {
  it("counts deliveries acted on, not clicks", async () => {
    const s = await setup("stats");
    // A second delivery that offers a lesson but is never opened.
    await prisma.feedbackDelivery.create({
      data: {
        userId: s.userId,
        attemptId: s.attemptId,
        body: "y",
        remediationLessonIds: [s.lessonId],
      },
    });
    // A third that offered nothing — must not count against uptake.
    await prisma.feedbackDelivery.create({
      data: {
        userId: s.userId,
        attemptId: s.attemptId,
        body: "z",
        remediationLessonIds: [],
      },
    });

    await recordRemediationClick(s.userId, s.deliveryId, s.lessonId);
    await recordRemediationClick(s.userId, s.deliveryId, s.lessonId);

    const stats = await getRemediationUptake(s.courseId);
    expect(stats.deliveriesWithRemediation).toBe(2);
    expect(stats.deliveriesActedOn).toBe(1);
    expect(stats.uptakeRate).toBe(0.5);
  });

  it("returns null rate when nothing offered remediation", async () => {
    const course = await prisma.course.create({
      data: { slug: `c-up-empty-${Date.now()}`, title: "C", description: "x" },
    });
    const stats = await getRemediationUptake(course.id);
    expect(stats.uptakeRate).toBeNull();
  });
});
