import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import {
  detectAndMarkResolved,
  recordMisconceptionsFromAttempt,
} from "../misconception";

interface Setup {
  userId: string;
  courseId: string;
  skillId: string;
  quizId: string;
  q1: string;
  q2: string;
  miscX: string;
  miscY: string;
  q1OptCorrect: string;
  q1OptWrongX: string;
  q2OptCorrect: string;
  q2OptWrongX: string;
  q2OptWrongY: string;
}

async function setup(slug: string): Promise<Setup> {
  const user = await prisma.user.create({
    data: { email: `r-${slug}@e.com`, passwordHash: "x", displayName: slug },
  });
  const course = await prisma.course.create({
    data: { slug: `r-${slug}`, title: "C", description: "x" },
  });
  const skill = await prisma.skill.create({
    data: { code: `r.${slug}`, name: "S" },
  });
  const miscX = await prisma.misconception.create({
    data: { code: `mcX-${slug}`, name: "X", description: "x" },
  });
  const miscY = await prisma.misconception.create({
    data: { code: `mcY-${slug}`, name: "Y", description: "y" },
  });
  const quiz = await prisma.quiz.create({
    data: { courseId: course.id, title: "Q" },
  });
  // Question 1: wrong option carries miscX.
  const q1 = await prisma.quizQuestion.create({
    data: { quizId: quiz.id, type: "mcq", prompt: "q1", points: 1, orderIndex: 0 },
  });
  await prisma.questionSkillTag.create({
    data: { questionId: q1.id, skillId: skill.id },
  });
  const q1Correct = await prisma.questionOption.create({
    data: { questionId: q1.id, label: "ok", isCorrect: true, orderIndex: 0 },
  });
  const q1WrongX = await prisma.questionOption.create({
    data: {
      questionId: q1.id,
      label: "trapX",
      isCorrect: false,
      misconceptionId: miscX.id,
      orderIndex: 1,
    },
  });
  // Question 2: wrong options carry miscX AND miscY.
  const q2 = await prisma.quizQuestion.create({
    data: { quizId: quiz.id, type: "mcq", prompt: "q2", points: 1, orderIndex: 1 },
  });
  await prisma.questionSkillTag.create({
    data: { questionId: q2.id, skillId: skill.id },
  });
  const q2Correct = await prisma.questionOption.create({
    data: { questionId: q2.id, label: "ok", isCorrect: true, orderIndex: 0 },
  });
  const q2WrongX = await prisma.questionOption.create({
    data: {
      questionId: q2.id,
      label: "trapX",
      isCorrect: false,
      misconceptionId: miscX.id,
      orderIndex: 1,
    },
  });
  const q2WrongY = await prisma.questionOption.create({
    data: {
      questionId: q2.id,
      label: "trapY",
      isCorrect: false,
      misconceptionId: miscY.id,
      orderIndex: 2,
    },
  });
  return {
    userId: user.id,
    courseId: course.id,
    skillId: skill.id,
    quizId: quiz.id,
    q1: q1.id,
    q2: q2.id,
    miscX: miscX.id,
    miscY: miscY.id,
    q1OptCorrect: q1Correct.id,
    q1OptWrongX: q1WrongX.id,
    q2OptCorrect: q2Correct.id,
    q2OptWrongX: q2WrongX.id,
    q2OptWrongY: q2WrongY.id,
  };
}

async function newAttempt(s: Setup) {
  return prisma.quizAttempt.create({
    data: { quizId: s.quizId, userId: s.userId, status: "submitted" },
  });
}

async function answer(
  attemptId: string,
  questionId: string,
  optionId: string,
  isCorrect: boolean,
) {
  await prisma.answerResponse.create({
    data: {
      attemptId,
      questionId,
      response: [optionId],
      isCorrect,
      responseTimeMs: 100,
    },
  });
}

describe("detectAndMarkResolved — B2.5 misconception cleared detection", () => {
  it("pre-existing flag + wrong answer to same question → does NOT resolve", async () => {
    const s = await setup("u1");
    // Seed an unresolved flag.
    await prisma.misconceptionFlag.create({
      data: { userId: s.userId, misconceptionId: s.miscX, count: 1 },
    });
    const a = await newAttempt(s);
    await answer(a.id, s.q1, s.q1OptWrongX, false);
    const detected = await recordMisconceptionsFromAttempt(s.userId, a.id);
    const r = await detectAndMarkResolved(s.userId, a.id, {
      excludeMisconceptionIds: detected.detected,
    });
    expect(r.resolved).toEqual([]);
    const flag = await prisma.misconceptionFlag.findUniqueOrThrow({
      where: {
        userId_misconceptionId: { userId: s.userId, misconceptionId: s.miscX },
      },
    });
    expect(flag.resolved).toBe(false);
  });

  it("pre-existing flag + correct answer to same question → resolves once, emits event", async () => {
    const s = await setup("u2");
    await prisma.misconceptionFlag.create({
      data: { userId: s.userId, misconceptionId: s.miscX, count: 2 },
    });
    const a = await newAttempt(s);
    await answer(a.id, s.q1, s.q1OptCorrect, true);
    const r = await detectAndMarkResolved(s.userId, a.id);
    expect(r.resolved).toEqual([s.miscX]);

    const flag = await prisma.misconceptionFlag.findUniqueOrThrow({
      where: {
        userId_misconceptionId: { userId: s.userId, misconceptionId: s.miscX },
      },
    });
    expect(flag.resolved).toBe(true);
    expect(flag.resolvedAt).not.toBeNull();

    const events = await prisma.learningEvent.findMany({
      where: {
        userId: s.userId,
        eventType: LearningEventType.MisconceptionResolved,
      },
    });
    expect(events).toHaveLength(1);
    const payload = events[0]!.payload as Record<string, unknown>;
    expect(payload.misconceptionId).toBe(s.miscX);
    expect(payload.attemptId).toBe(a.id);
    expect(payload.questionId).toBe(s.q1);
    expect(payload.skillIds).toEqual([s.skillId]);
  });

  it("pre-existing flag + correct answer on DIFFERENT question with same misconception → resolves", async () => {
    const s = await setup("u3");
    await prisma.misconceptionFlag.create({
      data: { userId: s.userId, misconceptionId: s.miscX, count: 1 },
    });
    const a = await newAttempt(s);
    // Q2 also exposes miscX as a wrong option, but learner picked correct.
    await answer(a.id, s.q2, s.q2OptCorrect, true);
    const r = await detectAndMarkResolved(s.userId, a.id);
    expect(r.resolved).toEqual([s.miscX]);
  });

  it("two flags on same skill — clearing only X leaves Y unresolved", async () => {
    const s = await setup("u4");
    await prisma.misconceptionFlag.createMany({
      data: [
        { userId: s.userId, misconceptionId: s.miscX, count: 1 },
        { userId: s.userId, misconceptionId: s.miscY, count: 1 },
      ],
    });
    const a = await newAttempt(s);
    // Q1 only tests X (no Y trap option), and learner answered correctly.
    await answer(a.id, s.q1, s.q1OptCorrect, true);
    const r = await detectAndMarkResolved(s.userId, a.id);
    expect(r.resolved).toEqual([s.miscX]);

    const yFlag = await prisma.misconceptionFlag.findUniqueOrThrow({
      where: {
        userId_misconceptionId: { userId: s.userId, misconceptionId: s.miscY },
      },
    });
    expect(yFlag.resolved).toBe(false);
  });

  it("resolved → re-wrong → flag re-armed, then correct emits a NEW event", async () => {
    const s = await setup("u5");

    // Cycle 1: detect via wrong, then resolve via correct in next attempt.
    const a1 = await newAttempt(s);
    await answer(a1.id, s.q1, s.q1OptWrongX, false);
    await recordMisconceptionsFromAttempt(s.userId, a1.id);

    const a2 = await newAttempt(s);
    await answer(a2.id, s.q1, s.q1OptCorrect, true);
    const r2 = await detectAndMarkResolved(s.userId, a2.id);
    expect(r2.resolved).toEqual([s.miscX]);

    // Cycle 2: re-trigger by failing again.
    const a3 = await newAttempt(s);
    await answer(a3.id, s.q1, s.q1OptWrongX, false);
    await recordMisconceptionsFromAttempt(s.userId, a3.id);
    const reArmed = await prisma.misconceptionFlag.findUniqueOrThrow({
      where: {
        userId_misconceptionId: { userId: s.userId, misconceptionId: s.miscX },
      },
    });
    expect(reArmed.resolved).toBe(false);
    expect(reArmed.resolvedAt).toBeNull();
    expect(reArmed.count).toBe(2);

    // Resolve again — should emit a SECOND resolved event.
    const a4 = await newAttempt(s);
    await answer(a4.id, s.q1, s.q1OptCorrect, true);
    const r4 = await detectAndMarkResolved(s.userId, a4.id);
    expect(r4.resolved).toEqual([s.miscX]);

    const allResolvedEvents = await prisma.learningEvent.findMany({
      where: {
        userId: s.userId,
        eventType: LearningEventType.MisconceptionResolved,
      },
    });
    expect(allResolvedEvents).toHaveLength(2);
  });

  it("same-attempt wrong+correct on same misconception → NOT auto-resolved (excludeMisconceptionIds guard)", async () => {
    const s = await setup("u6");
    const a = await newAttempt(s);
    // Wrong on q1 (triggers detection of miscX), correct on q2 (which also exposes miscX).
    await answer(a.id, s.q1, s.q1OptWrongX, false);
    await answer(a.id, s.q2, s.q2OptCorrect, true);

    const detected = await recordMisconceptionsFromAttempt(s.userId, a.id);
    expect(detected.detected).toEqual([s.miscX]);

    const r = await detectAndMarkResolved(s.userId, a.id, {
      excludeMisconceptionIds: detected.detected,
    });
    expect(r.resolved).toEqual([]);

    const flag = await prisma.misconceptionFlag.findUniqueOrThrow({
      where: {
        userId_misconceptionId: { userId: s.userId, misconceptionId: s.miscX },
      },
    });
    expect(flag.resolved).toBe(false);
  });
});
