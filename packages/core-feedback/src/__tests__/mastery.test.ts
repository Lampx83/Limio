import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import {
  getAverageMasteryForQuiz,
  MASTERY_THRESHOLD,
  updateLearnerStateFromAttempt,
} from "../learnerState";

interface Setup {
  userId: string;
  courseId: string;
  skillId: string;
  questionId: string;
  attemptId: string;
  quizId: string;
  optTrue: string;
  optFalse: string;
}

async function setup(slug: string): Promise<Setup> {
  const user = await prisma.user.create({
    data: { email: `m-${slug}@e.com`, passwordHash: "x", displayName: slug },
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
    quizId: quiz.id,
    optTrue: optTrue.id,
    optFalse: optFalse.id,
  };
}

describe("getAverageMasteryForQuiz (D3)", () => {
  it("returns null when no skill states yet (cold start)", async () => {
    const s = await setup("avg1");
    const avg = await getAverageMasteryForQuiz(s.userId, s.quizId);
    expect(avg).toBeNull();
  });

  it("returns the user's mastery when one state exists", async () => {
    const s = await setup("avg2");
    await prisma.learnerSkillState.create({
      data: { userId: s.userId, skillId: s.skillId, masteryProbability: 0.7 },
    });
    const avg = await getAverageMasteryForQuiz(s.userId, s.quizId);
    expect(avg).toBe(0.7);
  });

  it("ignores skills the quiz doesn't tag", async () => {
    const s = await setup("avg3");
    const otherSkill = await prisma.skill.create({
      data: { code: "skill.unrelated.avg3", name: "X" },
    });
    await prisma.learnerSkillState.createMany({
      data: [
        { userId: s.userId, skillId: s.skillId, masteryProbability: 0.5 },
        { userId: s.userId, skillId: otherSkill.id, masteryProbability: 0.95 },
      ],
    });
    const avg = await getAverageMasteryForQuiz(s.userId, s.quizId);
    expect(avg).toBe(0.5);
  });
});

describe("updateLearnerStateFromAttempt — newlyMastered (D4)", () => {
  it("AC-D4.1: returns skill in newlyMastered when crossing threshold", async () => {
    const s = await setup("nm1");
    // Seed prior state just under threshold.
    await prisma.learnerSkillState.create({
      data: {
        userId: s.userId, skillId: s.skillId,
        masteryProbability: 0.85, attempts: 5, correctCount: 4,
      },
    });
    // Correct answer → mastery rises across threshold.
    await prisma.answerResponse.create({
      data: {
        attemptId: s.attemptId, questionId: s.questionId,
        response: [s.optTrue], isCorrect: true, responseTimeMs: 100,
      },
    });
    const r = await updateLearnerStateFromAttempt(s.userId, s.attemptId);
    expect(r.newlyMastered).toHaveLength(1);
    expect(r.newlyMastered[0]!.skillCode).toBe(`skill.nm1`);
    expect(r.newlyMastered[0]!.masteryProbability).toBeGreaterThanOrEqual(MASTERY_THRESHOLD);
  });

  it("AC-D4.4: already mastered → not in newlyMastered list", async () => {
    const s = await setup("nm2");
    await prisma.learnerSkillState.create({
      data: {
        userId: s.userId, skillId: s.skillId,
        masteryProbability: 0.95, attempts: 10, correctCount: 9,
      },
    });
    await prisma.answerResponse.create({
      data: {
        attemptId: s.attemptId, questionId: s.questionId,
        response: [s.optTrue], isCorrect: true, responseTimeMs: 100,
      },
    });
    const r = await updateLearnerStateFromAttempt(s.userId, s.attemptId);
    expect(r.newlyMastered).toHaveLength(0);
  });

  it("doesn't cross threshold from low mastery in one answer → empty", async () => {
    const s = await setup("nm3");
    await prisma.answerResponse.create({
      data: {
        attemptId: s.attemptId, questionId: s.questionId,
        response: [s.optTrue], isCorrect: true, responseTimeMs: 100,
      },
    });
    const r = await updateLearnerStateFromAttempt(s.userId, s.attemptId);
    // 0.1 prior + 1 correct → should NOT cross 0.9 in one shot
    expect(r.newlyMastered).toHaveLength(0);
  });
});
