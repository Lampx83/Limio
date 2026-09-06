import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { generateDiagnosticFeedback } from "../diagnostic";
import { recordMisconceptionsFromAttempt } from "../misconception";

interface Setup {
  userId: string;
  courseId: string;
  skillId: string;
  questionId: string;
  attemptId: string;
  optCorrect: string;
  optWrongMisc: string;
  optWrongPlain: string;
  misconceptionId: string;
  remediationLessonId: string;
  completedLessonId: string;
}

async function setup(slug: string): Promise<Setup> {
  const user = await prisma.user.create({
    data: { email: `d-${slug}@e.com`, passwordHash: "x", displayName: slug },
  });
  const course = await prisma.course.create({
    data: { slug: `c-${slug}`, title: "C", description: "x" },
  });
  const mod = await prisma.module.create({
    data: { courseId: course.id, title: "M", orderIndex: 0 },
  });
  const completedLesson = await prisma.lesson.create({
    data: { moduleId: mod.id, title: "Already done", orderIndex: 0 },
  });
  const remediationLesson = await prisma.lesson.create({
    data: { moduleId: mod.id, title: "Should suggest", orderIndex: 1 },
  });
  const skill = await prisma.skill.create({
    data: { code: `skill.${slug}`, name: "S" },
  });
  await prisma.contentSkillMapping.createMany({
    data: [
      {
        contentType: "lesson",
        contentId: completedLesson.id,
        skillId: skill.id,
        coverageWeight: 0.9,
      },
      {
        contentType: "lesson",
        contentId: remediationLesson.id,
        skillId: skill.id,
        coverageWeight: 0.8,
      },
    ],
  });
  // Mark completedLesson as already done.
  await prisma.learningEvent.create({
    data: {
      userId: user.id,
      courseId: course.id,
      eventType: LearningEventType.LessonCompleted,
      payload: { lessonId: completedLesson.id, reason: "marked_complete" },
      eventKey: `lesson.completed:${user.id}:${completedLesson.id}`,
    },
  });

  const misconception = await prisma.misconception.create({
    data: { code: `mc-${slug}`, name: "MC", description: "x" },
  });
  const quiz = await prisma.quiz.create({
    data: { courseId: course.id, title: "Q" },
  });
  const question = await prisma.quizQuestion.create({
    data: { quizId: quiz.id, type: "mcq", prompt: "p", points: 1, orderIndex: 0 },
  });
  await prisma.questionSkillTag.create({
    data: { questionId: question.id, skillId: skill.id },
  });
  const optCorrect = await prisma.questionOption.create({
    data: { questionId: question.id, label: "right", isCorrect: true, orderIndex: 0 },
  });
  const optWrongMisc = await prisma.questionOption.create({
    data: {
      questionId: question.id,
      label: "wrong-with-misc",
      isCorrect: false,
      misconceptionId: misconception.id,
      orderIndex: 1,
    },
  });
  const optWrongPlain = await prisma.questionOption.create({
    data: { questionId: question.id, label: "wrong-plain", isCorrect: false, orderIndex: 2 },
  });
  const attempt = await prisma.quizAttempt.create({
    data: { quizId: quiz.id, userId: user.id, status: "submitted" },
  });
  return {
    userId: user.id,
    courseId: course.id,
    skillId: skill.id,
    questionId: question.id,
    attemptId: attempt.id,
    optCorrect: optCorrect.id,
    optWrongMisc: optWrongMisc.id,
    optWrongPlain: optWrongPlain.id,
    misconceptionId: misconception.id,
    remediationLessonId: remediationLesson.id,
    completedLessonId: completedLesson.id,
  };
}

describe("recordMisconceptionsFromAttempt", () => {
  it("AC-B1.8: increments MisconceptionFlag count + emits misconception.detected", async () => {
    const s = await setup("m1");
    await prisma.answerResponse.create({
      data: {
        attemptId: s.attemptId,
        questionId: s.questionId,
        response: [s.optWrongMisc],
        isCorrect: false,
        responseTimeMs: 100,
      },
    });
    const r = await recordMisconceptionsFromAttempt(s.userId, s.attemptId);
    expect(r.detected).toEqual([s.misconceptionId]);
    const flag = await prisma.misconceptionFlag.findUniqueOrThrow({
      where: {
        userId_misconceptionId: { userId: s.userId, misconceptionId: s.misconceptionId },
      },
    });
    expect(flag.count).toBe(1);

    // Repeat — count should increment.
    const a2 = await prisma.quizAttempt.create({
      data: { quizId: (await prisma.quiz.findFirstOrThrow({ where: { courseId: s.courseId } })).id, userId: s.userId, status: "submitted" },
    });
    await prisma.answerResponse.create({
      data: {
        attemptId: a2.id, questionId: s.questionId,
        response: [s.optWrongMisc], isCorrect: false, responseTimeMs: 100,
      },
    });
    await recordMisconceptionsFromAttempt(s.userId, a2.id);
    const flag2 = await prisma.misconceptionFlag.findUniqueOrThrow({
      where: {
        userId_misconceptionId: { userId: s.userId, misconceptionId: s.misconceptionId },
      },
    });
    expect(flag2.count).toBe(2);
  });

  it("plain wrong answer (no misconception) does nothing", async () => {
    const s = await setup("m2");
    await prisma.answerResponse.create({
      data: {
        attemptId: s.attemptId, questionId: s.questionId,
        response: [s.optWrongPlain], isCorrect: false, responseTimeMs: 100,
      },
    });
    const r = await recordMisconceptionsFromAttempt(s.userId, s.attemptId);
    expect(r.detected).toHaveLength(0);
  });
});

describe("generateDiagnosticFeedback", () => {
  it("AC-B3.3 / AC-B3.5: uses per-misconception template; persists FeedbackDelivery", async () => {
    const s = await setup("d1");
    // Per-misconception template.
    await prisma.feedbackTemplate.create({
      data: {
        scope: "per_misconception",
        misconceptionId: s.misconceptionId,
        body: "Bạn nhầm dấu rồi.",
      },
    });
    await prisma.answerResponse.create({
      data: {
        attemptId: s.attemptId, questionId: s.questionId,
        response: [s.optWrongMisc], isCorrect: false, responseTimeMs: 100,
      },
    });
    const r = await generateDiagnosticFeedback(s.userId, s.attemptId);
    expect(r.deliveries).toHaveLength(1);
    expect(r.deliveries[0]!.body).toBe("Bạn nhầm dấu rồi.");
    expect(r.deliveries[0]!.misconceptionCode).toMatch(/^mc-d1$/);

    const persisted = await prisma.feedbackDelivery.findFirstOrThrow({
      where: { attemptId: s.attemptId, questionId: s.questionId },
    });
    expect(persisted.body).toBe("Bạn nhầm dấu rồi.");
  });

  it("falls back to generic template when no per-misconception match", async () => {
    const s = await setup("d2");
    await prisma.feedbackTemplate.create({
      data: { scope: "generic", body: "Generic msg" },
    });
    await prisma.answerResponse.create({
      data: {
        attemptId: s.attemptId, questionId: s.questionId,
        response: [s.optWrongPlain], isCorrect: false, responseTimeMs: 100,
      },
    });
    const r = await generateDiagnosticFeedback(s.userId, s.attemptId);
    expect(r.deliveries[0]!.body).toBe("Generic msg");
    expect(r.deliveries[0]!.misconceptionCode).toBeNull();
  });

  it("falls back to default body when no templates seeded", async () => {
    const s = await setup("d3");
    await prisma.answerResponse.create({
      data: {
        attemptId: s.attemptId, questionId: s.questionId,
        response: [s.optWrongPlain], isCorrect: false, responseTimeMs: 100,
      },
    });
    const r = await generateDiagnosticFeedback(s.userId, s.attemptId);
    expect(r.deliveries[0]!.body).toContain("đọc lại");
  });

  it("AC-B3.4: remediation excludes already-completed lessons + caps at 3", async () => {
    const s = await setup("d4");
    await prisma.answerResponse.create({
      data: {
        attemptId: s.attemptId, questionId: s.questionId,
        response: [s.optWrongMisc], isCorrect: false, responseTimeMs: 100,
      },
    });
    const r = await generateDiagnosticFeedback(s.userId, s.attemptId);
    // completedLesson should be excluded; remediationLesson should appear.
    expect(r.deliveries[0]!.remediationLessonIds).toContain(s.remediationLessonId);
    expect(r.deliveries[0]!.remediationLessonIds).not.toContain(s.completedLessonId);
  });

  it("AC-B3.6: emits feedback.delivered event", async () => {
    const s = await setup("d5");
    await prisma.answerResponse.create({
      data: {
        attemptId: s.attemptId, questionId: s.questionId,
        response: [s.optWrongPlain], isCorrect: false, responseTimeMs: 100,
      },
    });
    await generateDiagnosticFeedback(s.userId, s.attemptId);
    const events = await prisma.learningEvent.findMany({
      where: { userId: s.userId, eventType: LearningEventType.FeedbackDelivered },
    });
    expect(events).toHaveLength(1);
  });

  it("does NOT emit feedback for correct answers", async () => {
    const s = await setup("d6");
    await prisma.answerResponse.create({
      data: {
        attemptId: s.attemptId, questionId: s.questionId,
        response: [s.optCorrect], isCorrect: true, responseTimeMs: 100,
      },
    });
    const r = await generateDiagnosticFeedback(s.userId, s.attemptId);
    expect(r.deliveries).toHaveLength(0);
  });
});

describe("B9.1 — SSMMD coding is written at generation time", () => {
  it("AC-2.1/2.2/2.6: a misconception plus remediation codes as elaborated self-regulation", async () => {
    const s = await setup("b9a");
    await prisma.feedbackTemplate.create({
      data: {
        scope: "per_misconception",
        misconceptionId: s.misconceptionId,
        body: "Bạn nhầm tương quan với nhân quả.",
      },
    });
    await prisma.answerResponse.create({
      data: {
        attemptId: s.attemptId,
        questionId: s.questionId,
        response: [s.optWrongMisc],
        isCorrect: false,
        responseTimeMs: 100,
      },
    });

    await generateDiagnosticFeedback(s.userId, s.attemptId, undefined, {
      masterySnapshot: { [s.skillId]: 0.23 },
    });

    const d = await prisma.feedbackDelivery.findFirstOrThrow({
      where: { userId: s.userId, attemptId: s.attemptId },
    });
    expect(d.level).toBe("self_regulation");
    expect(d.levels).toEqual(["task", "process", "self_regulation"]);
    expect(d.elaboration).toBe("elaborated");
    expect(d.sourceKind).toBe("misconception");

    // AC-2.7 — enough context to reconstruct the decision.
    expect(d.generationContext).toMatchObject({
      templateScope: "per_misconception",
      skillIds: [s.skillId],
      remediationLessonIds: [s.remediationLessonId],
      // The completed lesson matched the skill but was dropped.
      remediationExcludedCompleted: 1,
      masteryAtGeneration: { [s.skillId]: 0.23 },
    });
    const ctx = d.generationContext as { coderVersion?: string };
    expect(typeof ctx.coderVersion).toBe("string");
  });

  it("AC-2.7: mastery is absent, not invented, when no snapshot is supplied", async () => {
    const s = await setup("b9b");
    await prisma.answerResponse.create({
      data: {
        attemptId: s.attemptId,
        questionId: s.questionId,
        response: [s.optWrongPlain],
        isCorrect: false,
        responseTimeMs: 100,
      },
    });

    await generateDiagnosticFeedback(s.userId, s.attemptId);

    const d = await prisma.feedbackDelivery.findFirstOrThrow({
      where: { userId: s.userId, attemptId: s.attemptId },
    });
    expect(d.generationContext).not.toHaveProperty("masteryAtGeneration");
    // No misconception on this option, but remediation still routes them.
    expect(d.level).toBe("self_regulation");
    expect(d.elaboration).toBe("kh");
    expect(d.sourceKind).toBe("rule_template");
  });

  it("AC-B3.6 + B9: the delivered event carries the coordinates too", async () => {
    const s = await setup("b9c");
    await prisma.answerResponse.create({
      data: {
        attemptId: s.attemptId,
        questionId: s.questionId,
        response: [s.optWrongPlain],
        isCorrect: false,
        responseTimeMs: 100,
      },
    });
    await generateDiagnosticFeedback(s.userId, s.attemptId);
    const ev = await prisma.learningEvent.findFirstOrThrow({
      where: { userId: s.userId, eventType: LearningEventType.FeedbackDelivered },
    });
    expect(ev.payload).toMatchObject({
      level: "self_regulation",
      elaboration: "kh",
      sourceKind: "rule_template",
    });
  });
});
