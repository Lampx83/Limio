import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import {
  getAdaptiveNextLesson,
  getRemedialSuggestion,
  shouldSkipLesson,
} from "../adaptivePath";

interface BaseSetup {
  userId: string;
  courseId: string;
  moduleId: string;
  lessonA: string; // tagged with skillX
  lessonB: string; // tagged with skillX
  skillX: string;
  skillY: string;
}

async function baseSetup(slug: string): Promise<BaseSetup> {
  const user = await prisma.user.create({
    data: { email: `ap-${slug}@e.com`, passwordHash: "x", displayName: slug },
  });
  const course = await prisma.course.create({
    data: { slug: `c-${slug}`, title: "C", description: "x" },
  });
  const m = await prisma.module.create({
    data: { courseId: course.id, title: "M", orderIndex: 0 },
  });
  const lessonA = await prisma.lesson.create({
    data: { moduleId: m.id, title: "Lesson A", orderIndex: 0 },
  });
  const lessonB = await prisma.lesson.create({
    data: { moduleId: m.id, title: "Lesson B", orderIndex: 1 },
  });
  const skillX = await prisma.skill.create({
    data: { code: `skill.x.${slug}`, name: "Skill X" },
  });
  const skillY = await prisma.skill.create({
    data: { code: `skill.y.${slug}`, name: "Skill Y" },
  });
  await prisma.contentSkillMapping.createMany({
    data: [
      { contentType: "lesson", contentId: lessonA.id, skillId: skillX.id, coverageWeight: 0.9 },
      { contentType: "lesson", contentId: lessonB.id, skillId: skillX.id, coverageWeight: 0.5 },
    ],
  });
  return {
    userId: user.id,
    courseId: course.id,
    moduleId: m.id,
    lessonA: lessonA.id,
    lessonB: lessonB.id,
    skillX: skillX.id,
    skillY: skillY.id,
  };
}

describe("shouldSkipLesson", () => {
  it("AC-B4.2: untagged lesson → no skip", async () => {
    const s = await baseSetup("ss1");
    const orphan = await prisma.lesson.create({
      data: { moduleId: s.moduleId, title: "Untagged", orderIndex: 99 },
    });
    const r = await shouldSkipLesson(s.userId, orphan.id);
    expect(r.shouldSkip).toBe(false);
    expect(r.reason).toBe("no_skill_tags");
  });

  it("AC-B4.3: tagged but no LearnerSkillState yet → no skip (cold start)", async () => {
    const s = await baseSetup("ss2");
    const r = await shouldSkipLesson(s.userId, s.lessonA);
    expect(r.shouldSkip).toBe(false);
    expect(r.masteries).toHaveLength(1);
    expect(r.masteries[0]!.blocking).toBe(true);
  });

  it("AC-B4.4: mastery < 0.85 → no skip", async () => {
    const s = await baseSetup("ss3");
    await prisma.learnerSkillState.create({
      data: {
        userId: s.userId,
        skillId: s.skillX,
        masteryProbability: 0.7,
        attempts: 3,
        correctCount: 2,
      },
    });
    const r = await shouldSkipLesson(s.userId, s.lessonA);
    expect(r.shouldSkip).toBe(false);
  });

  it("AC-B4.1: mastery ≥ 0.85 for all tagged skills → skip", async () => {
    const s = await baseSetup("ss4");
    await prisma.learnerSkillState.create({
      data: {
        userId: s.userId,
        skillId: s.skillX,
        masteryProbability: 0.92,
        attempts: 5,
        correctCount: 5,
      },
    });
    const r = await shouldSkipLesson(s.userId, s.lessonA);
    expect(r.shouldSkip).toBe(true);
    expect(r.masteries[0]!.blocking).toBe(false);
  });

  it("multi-skill: any one below threshold blocks the skip", async () => {
    const s = await baseSetup("ss5");
    // Tag lessonA with both skills.
    await prisma.contentSkillMapping.create({
      data: { contentType: "lesson", contentId: s.lessonA, skillId: s.skillY, coverageWeight: 0.8 },
    });
    await prisma.learnerSkillState.createMany({
      data: [
        { userId: s.userId, skillId: s.skillX, masteryProbability: 0.95, attempts: 5, correctCount: 5 },
        { userId: s.userId, skillId: s.skillY, masteryProbability: 0.6, attempts: 2, correctCount: 1 },
      ],
    });
    const r = await shouldSkipLesson(s.userId, s.lessonA);
    expect(r.shouldSkip).toBe(false);
    const blocking = r.masteries.filter((m) => m.blocking);
    expect(blocking).toHaveLength(1);
    expect(blocking[0]!.skillId).toBe(s.skillY);
  });
});

interface RemedialSetup extends BaseSetup {
  quizId: string;
  questionId: string;
}

async function remedialSetup(slug: string): Promise<RemedialSetup> {
  const base = await baseSetup(slug);
  const quiz = await prisma.quiz.create({
    data: { courseId: base.courseId, title: "Q" },
  });
  const question = await prisma.quizQuestion.create({
    data: { quizId: quiz.id, type: "true_false", prompt: "p", points: 1, orderIndex: 0 },
  });
  await prisma.questionSkillTag.create({
    data: { questionId: question.id, skillId: base.skillX },
  });
  return { ...base, quizId: quiz.id, questionId: question.id };
}

async function recordSubmittedAttempt(
  s: RemedialSetup,
  passed: boolean,
  whenAgoMs = 0,
) {
  return prisma.quizAttempt.create({
    data: {
      quizId: s.quizId,
      userId: s.userId,
      status: "submitted",
      submittedAt: new Date(Date.now() - whenAgoMs),
      passed,
      scorePct: passed ? 90 : 30,
    },
  });
}

describe("getRemedialSuggestion", () => {
  it("AC-B4.8: 0 fails → no suggestion", async () => {
    const s = await remedialSetup("rm1");
    const r = await getRemedialSuggestion(s.userId, s.quizId);
    expect(r.shouldShow).toBe(false);
  });

  it("1 fail only → no suggestion (need 2)", async () => {
    const s = await remedialSetup("rm2");
    await recordSubmittedAttempt(s, false);
    const r = await getRemedialSuggestion(s.userId, s.quizId);
    expect(r.shouldShow).toBe(false);
  });

  it("AC-B4.7: last 2 attempts both failed → suggestion with weakest skill + lesson", async () => {
    const s = await remedialSetup("rm3");
    await prisma.learnerSkillState.create({
      data: {
        userId: s.userId,
        skillId: s.skillX,
        masteryProbability: 0.25,
        attempts: 4,
        correctCount: 1,
      },
    });
    // Both submitted attempts failed (in chronological order, oldest first).
    await recordSubmittedAttempt(s, false, 60_000);
    await recordSubmittedAttempt(s, false, 0);

    const r = await getRemedialSuggestion(s.userId, s.quizId);
    expect(r.shouldShow).toBe(true);
    expect(r.weakestSkill?.skillId).toBe(s.skillX);
    expect(r.lesson?.id).toBe(s.lessonA); // higher coverageWeight
  });

  it("most recent attempt passed → no suggestion (broke the streak)", async () => {
    const s = await remedialSetup("rm4");
    await recordSubmittedAttempt(s, false, 120_000);
    await recordSubmittedAttempt(s, true, 0);
    const r = await getRemedialSuggestion(s.userId, s.quizId);
    expect(r.shouldShow).toBe(false);
  });

  it("excludes lesson learner already completed", async () => {
    const s = await remedialSetup("rm5");
    await prisma.learnerSkillState.create({
      data: {
        userId: s.userId,
        skillId: s.skillX,
        masteryProbability: 0.25,
        attempts: 4,
        correctCount: 1,
      },
    });
    // lessonA is the higher-coverage one — mark it completed.
    await prisma.learningEvent.create({
      data: {
        userId: s.userId,
        courseId: s.courseId,
        eventType: "lesson.completed",
        payload: { lessonId: s.lessonA },
        eventKey: `lesson.completed:${s.userId}:${s.lessonA}`,
      },
    });
    await recordSubmittedAttempt(s, false, 60_000);
    await recordSubmittedAttempt(s, false, 0);
    const r = await getRemedialSuggestion(s.userId, s.quizId);
    expect(r.shouldShow).toBe(true);
    expect(r.lesson?.id).toBe(s.lessonB);
  });

  it("no skill data yet → shouldShow false", async () => {
    const s = await remedialSetup("rm6");
    await recordSubmittedAttempt(s, false, 60_000);
    await recordSubmittedAttempt(s, false, 0);
    const r = await getRemedialSuggestion(s.userId, s.quizId);
    expect(r.shouldShow).toBe(false);
    expect(r.reason).toBe("no_skill_data");
  });
});

describe("getAdaptiveNextLesson", () => {
  it("AC-B4.14: no skill data → null", async () => {
    const s = await baseSetup("an1");
    const r = await getAdaptiveNextLesson(s.userId, s.courseId);
    expect(r).toBeNull();
  });

  it("AC-B4.13: all skills mastered (≥0.85) → null", async () => {
    const s = await baseSetup("an2");
    await prisma.learnerSkillState.create({
      data: {
        userId: s.userId,
        skillId: s.skillX,
        masteryProbability: 0.95,
        attempts: 10,
        correctCount: 9,
      },
    });
    const r = await getAdaptiveNextLesson(s.userId, s.courseId);
    expect(r).toBeNull();
  });

  it("AC-B4.12: weak skill + uncompleted lesson → returns the higher-coverage lesson", async () => {
    const s = await baseSetup("an3");
    await prisma.learnerSkillState.create({
      data: {
        userId: s.userId,
        skillId: s.skillX,
        masteryProbability: 0.4,
        attempts: 4,
        correctCount: 1,
      },
    });
    const r = await getAdaptiveNextLesson(s.userId, s.courseId);
    expect(r?.lessonId).toBe(s.lessonA);
    expect(r?.weakestSkillCode).toContain("skill.x");
  });

  it("excludes already-completed lessons", async () => {
    const s = await baseSetup("an4");
    await prisma.learnerSkillState.create({
      data: {
        userId: s.userId,
        skillId: s.skillX,
        masteryProbability: 0.4,
        attempts: 4,
        correctCount: 1,
      },
    });
    await prisma.learningEvent.create({
      data: {
        userId: s.userId,
        courseId: s.courseId,
        eventType: "lesson.completed",
        payload: { lessonId: s.lessonA },
        eventKey: `lesson.completed:${s.userId}:${s.lessonA}`,
      },
    });
    const r = await getAdaptiveNextLesson(s.userId, s.courseId);
    expect(r?.lessonId).toBe(s.lessonB);
  });
});
