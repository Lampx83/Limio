import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import {
  getLearnerSkillStates,
  updateLearnerStateFromAttempt,
} from "../learnerState";

interface Setup {
  userId: string;
  courseId: string;
  skillId: string;
  questionId: string;
  attemptId: string;
  optTrue: string; // correct option
  optFalse: string; // wrong option
}

async function setup(slug: string): Promise<Setup> {
  const user = await prisma.user.create({
    data: { email: `f-${slug}@e.com`, passwordHash: "x", displayName: slug },
  });
  const course = await prisma.course.create({
    data: { slug: `c-${slug}`, title: "C", description: "x" },
  });
  const mod = await prisma.module.create({
    data: { courseId: course.id, title: "M", orderIndex: 0 },
  });
  const lesson = await prisma.lesson.create({
    data: { moduleId: mod.id, title: "L", orderIndex: 0 },
  });
  const skill = await prisma.skill.create({
    data: { code: `skill.${slug}`, name: "S" },
  });
  await prisma.contentSkillMapping.create({
    data: { contentType: "lesson", contentId: lesson.id, skillId: skill.id },
  });
  const quiz = await prisma.quiz.create({
    data: { courseId: course.id, title: "Q" },
  });
  const question = await prisma.quizQuestion.create({
    data: { quizId: quiz.id, type: "true_false", prompt: "p", points: 1, orderIndex: 0 },
  });
  const optTrue = await prisma.questionOption.create({
    data: { questionId: question.id, label: "T", isCorrect: true, orderIndex: 0 },
  });
  const optFalse = await prisma.questionOption.create({
    data: { questionId: question.id, label: "F", isCorrect: false, orderIndex: 1 },
  });
  await prisma.questionSkillTag.create({
    data: { questionId: question.id, skillId: skill.id },
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
    optTrue: optTrue.id,
    optFalse: optFalse.id,
  };
}

describe("updateLearnerStateFromAttempt", () => {
  it("AC-B1.5: first answer creates state with correct counts", async () => {
    const s = await setup("s1");
    await prisma.answerResponse.create({
      data: {
        attemptId: s.attemptId,
        questionId: s.questionId,
        response: [s.optTrue],
        isCorrect: true,
        responseTimeMs: 100,
      },
    });
    const r = await updateLearnerStateFromAttempt(s.userId, s.attemptId);
    expect(r.skillsUpdated).toBe(1);
    expect(r.answersProcessed).toBe(1);

    const state = await prisma.learnerSkillState.findUniqueOrThrow({
      where: { userId_skillId: { userId: s.userId, skillId: s.skillId } },
    });
    expect(state.attempts).toBe(1);
    expect(state.correctCount).toBe(1);
    expect(state.masteryProbability).toBeGreaterThan(0.1); // bumped from prior
  });

  it("AC-B1.7: emits skill.state.updated event", async () => {
    const s = await setup("s2");
    await prisma.answerResponse.create({
      data: {
        attemptId: s.attemptId, questionId: s.questionId,
        response: [s.optTrue], isCorrect: true, responseTimeMs: 100,
      },
    });
    await updateLearnerStateFromAttempt(s.userId, s.attemptId);
    const events = await prisma.learningEvent.findMany({
      where: { userId: s.userId, eventType: LearningEventType.SkillStateUpdated },
    });
    expect(events).toHaveLength(1);
    expect((events[0]!.payload as { skillId: string }).skillId).toBe(s.skillId);
  });

  it("AC-B1.4: incorrect answer drops mastery from default prior", async () => {
    const s = await setup("s3");
    await prisma.answerResponse.create({
      data: {
        attemptId: s.attemptId, questionId: s.questionId,
        response: [s.optFalse], isCorrect: false, responseTimeMs: 100,
      },
    });
    await updateLearnerStateFromAttempt(s.userId, s.attemptId);
    const state = await prisma.learnerSkillState.findUniqueOrThrow({
      where: { userId_skillId: { userId: s.userId, skillId: s.skillId } },
    });
    // Prior 0.1, incorrect: posterior = 0.1*0.1 / (0.1*0.1 + 0.9*0.8) = 0.01/0.73 ≈ 0.0137
    // newMastery = 0.0137 + (1 - 0.0137) * 0.1 ≈ 0.112 — slightly higher (transition adds)
    expect(state.masteryProbability).toBeLessThan(0.2);
    expect(state.attempts).toBe(1);
    expect(state.correctCount).toBe(0);
  });

  it("AC-B1.9: getLearnerSkillStates returns weak flag when mastery<0.5 and attempts≥2", async () => {
    const s = await setup("s4");
    // Two wrong answers
    await prisma.answerResponse.create({
      data: {
        attemptId: s.attemptId, questionId: s.questionId,
        response: [s.optFalse], isCorrect: false, responseTimeMs: 100,
      },
    });
    await updateLearnerStateFromAttempt(s.userId, s.attemptId);

    // Second attempt
    const a2 = await prisma.quizAttempt.create({
      data: { quizId: (await prisma.quiz.findFirstOrThrow({ where: { courseId: s.courseId } })).id, userId: s.userId, status: "submitted" },
    });
    await prisma.answerResponse.create({
      data: {
        attemptId: a2.id, questionId: s.questionId,
        response: [s.optFalse], isCorrect: false, responseTimeMs: 100,
      },
    });
    await updateLearnerStateFromAttempt(s.userId, a2.id);

    const list = await getLearnerSkillStates(s.userId, undefined);
    expect(list).toHaveLength(1);
    expect(list[0]!.attempts).toBe(2);
    expect(list[0]!.isWeak).toBe(true);
  });

  it("filters by courseId — only returns skills tagged in that course", async () => {
    const s1 = await setup("c1");
    const s2 = await setup("c2");
    // Bump mastery in both courses for the same user.
    await prisma.answerResponse.create({
      data: {
        attemptId: s1.attemptId, questionId: s1.questionId,
        response: [s1.optTrue], isCorrect: true, responseTimeMs: 100,
      },
    });
    await updateLearnerStateFromAttempt(s1.userId, s1.attemptId);
    // Stitch user in s2's course as well
    const otherAttempt = await prisma.quizAttempt.create({
      data: { quizId: (await prisma.quiz.findFirstOrThrow({ where: { courseId: s2.courseId } })).id, userId: s1.userId, status: "submitted" },
    });
    await prisma.answerResponse.create({
      data: {
        attemptId: otherAttempt.id, questionId: s2.questionId,
        response: [s2.optTrue], isCorrect: true, responseTimeMs: 100,
      },
    });
    await updateLearnerStateFromAttempt(s1.userId, otherAttempt.id);

    const inCourse1 = await getLearnerSkillStates(s1.userId, s1.courseId);
    const inCourse2 = await getLearnerSkillStates(s1.userId, s2.courseId);
    expect(inCourse1.map((x) => x.skillId)).toEqual([s1.skillId]);
    expect(inCourse2.map((x) => x.skillId)).toEqual([s2.skillId]);
  });
});
