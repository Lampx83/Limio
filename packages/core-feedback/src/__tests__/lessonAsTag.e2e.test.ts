/**
 * B1.5 AC-4.x — the join between core-lms (which provisions lesson tags) and
 * the Feedback Engine (which consumes them).
 *
 * The individual pieces are covered elsewhere: core-lms proves the rows get
 * written, and the rest of this suite proves feedback works once rows exist.
 * What this file proves is that an instructor who tags nothing still ends up
 * with a learner who gets remediation — i.e. the wiring actually carries
 * current.
 *
 * core-lms is a devDependency used for fixtures only; nothing in
 * packages/core-feedback/src imports it (§4.3 module boundary), same
 * arrangement core-gamification's tests use.
 */

import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import {
  createCourse,
  createLesson,
  createModule,
  createQuestion,
  createQuiz,
  enrollInCourse,
  publishCourse,
  registerUser,
  startAttempt,
  submitAnswer,
  submitAttempt,
} from "@feedbackme/core-lms";
import { generateDiagnosticFeedback } from "../diagnostic";
import { updateLearnerStateFromAttempt } from "../learnerState";
import { getRemedialSuggestion, shouldSkipLesson } from "../adaptivePath";

const BASE = "http://localhost:3000";

interface Fixture {
  instructorId: string;
  learnerId: string;
  courseId: string;
  /** The lesson the quiz hangs off — also the remediation target. */
  quizLessonId: string;
  /** A second, never-visited lesson so remediation has somewhere to point. */
  otherLessonId: string;
  quizId: string;
  questionIds: string[];
  wrongOptionIds: string[];
}

/**
 * Build a course the way an instructor actually would — no skill, no tagging
 * step anywhere. Everything the Feedback Engine needs must be auto-provisioned.
 */
async function buildUntaggedCourse(slug: string): Promise<Fixture> {
  const instructor = await registerUser(
    { email: `e2e-i-${slug}@example.com`, password: "password1234", displayName: "GV" },
    BASE,
  );
  const learner = await registerUser(
    { email: `e2e-l-${slug}@example.com`, password: "password1234", displayName: "HV" },
    BASE,
  );

  const course = await createCourse(instructor.userId, {
    title: "Thống kê cơ bản",
    description: "Khoá học dùng cho e2e test B1.5.",
    slug: `e2e-${slug}`,
  });
  const mod = await createModule(instructor.userId, course.courseId, {
    title: "Chương 1",
    orderIndex: 0,
  });
  const quizLesson = await createLesson(instructor.userId, mod.moduleId, {
    title: "Hồi quy tuyến tính",
    orderIndex: 0,
  });
  const otherLesson = await createLesson(instructor.userId, mod.moduleId, {
    title: "Tương quan",
    orderIndex: 1,
  });

  const quiz = await createQuiz(
    instructor.userId,
    { courseId: course.courseId, lessonId: quizLesson.lessonId },
    { title: "Kiểm tra hồi quy", passThresholdPct: 70, requireConfidence: false },
  );

  const questionIds: string[] = [];
  for (let i = 0; i < 2; i++) {
    const q = await createQuestion(instructor.userId, quiz.quizId, {
      type: "mcq",
      prompt: `Câu ${i + 1}: hệ số góc là gì?`,
      orderIndex: i,
      options: [
        { label: "Đáp án đúng", isCorrect: true },
        { label: "Đáp án sai", isCorrect: false },
      ],
    });
    questionIds.push(q.questionId);
  }

  await publishCourse(instructor.userId, course.courseId);
  await enrollInCourse(learner.userId, course.courseId);

  const wrongOptions = await prisma.questionOption.findMany({
    where: { questionId: { in: questionIds }, isCorrect: false },
    orderBy: { questionId: "asc" },
  });

  return {
    instructorId: instructor.userId,
    learnerId: learner.userId,
    courseId: course.courseId,
    quizLessonId: quizLesson.lessonId,
    otherLessonId: otherLesson.lessonId,
    quizId: quiz.quizId,
    questionIds,
    wrongOptionIds: wrongOptions.map((o) => o.id),
  };
}

/** Answer every question wrong and submit. */
async function failAttempt(f: Fixture): Promise<string> {
  const attempt = await startAttempt(f.learnerId, f.quizId);
  for (const questionId of f.questionIds) {
    const wrong = await prisma.questionOption.findFirstOrThrow({
      where: { questionId, isCorrect: false },
    });
    await submitAnswer(f.learnerId, attempt.attemptId, {
      questionId,
      response: [wrong.id],
    });
  }
  const result = await submitAttempt(f.learnerId, attempt.attemptId);
  expect(result.passed).toBe(false);
  return attempt.attemptId;
}

describe("B1.5 — an untagged course still produces personalized feedback", () => {
  it("AC-4.1: wrong answers get remediation lessons without any manual tagging", async () => {
    const f = await buildUntaggedCourse("remediation");
    const attemptId = await failAttempt(f);

    const { deliveries } = await generateDiagnosticFeedback(f.learnerId, attemptId);

    expect(deliveries).toHaveLength(2);
    for (const d of deliveries) {
      expect(d.remediationLessonIds).toContain(f.quizLessonId);
    }
  });

  it("AC-4.4: BKT writes learner state keyed on the lesson tag", async () => {
    const f = await buildUntaggedCourse("bkt");
    const attemptId = await failAttempt(f);

    const bkt = await updateLearnerStateFromAttempt(f.learnerId, attemptId);

    expect(bkt.skillsUpdated).toBe(1);
    const states = await prisma.learnerSkillState.findMany({
      where: { userId: f.learnerId },
      include: { skill: true },
    });
    expect(states).toHaveLength(1);
    expect(states[0]!.skill.name).toBe("Hồi quy tuyến tính");
    // Two wrong answers leave the learner far from mastery. (BKT's learn rate
    // nudges P(L) up after every observation, so the number doesn't strictly
    // fall below the 0.1 prior — what matters is it stays low.)
    expect(states[0]!.masteryProbability).toBeLessThan(0.3);
    expect(states[0]!.attempts).toBe(2);
  });

  it("AC-4.2: two failed attempts surface a remedial suggestion", async () => {
    const f = await buildUntaggedCourse("remedial");
    for (let i = 0; i < 2; i++) {
      const attemptId = await failAttempt(f);
      await updateLearnerStateFromAttempt(f.learnerId, attemptId);
    }

    const suggestion = await getRemedialSuggestion(f.learnerId, f.quizId);

    expect(suggestion.reason).not.toBe("quiz_skills_untagged");
    expect(suggestion.shouldShow).toBe(true);
    expect(suggestion.weakestSkill?.skillName).toBe("Hồi quy tuyến tính");
    expect(suggestion.lesson?.id).toBe(f.quizLessonId);
  });

  it("AC-4.3: a mastered lesson becomes skippable", async () => {
    const f = await buildUntaggedCourse("skip");

    const cold = await shouldSkipLesson(f.learnerId, f.quizLessonId);
    // Tagged from birth — the blocker is missing data, never a missing tag.
    expect(cold.reason).not.toBe("no_skill_tags");
    expect(cold.shouldSkip).toBe(false);
    expect(cold.masteries).toHaveLength(1);

    const tag = await prisma.contentSkillMapping.findFirstOrThrow({
      where: { contentType: "lesson", contentId: f.quizLessonId },
    });
    await prisma.learnerSkillState.create({
      data: {
        userId: f.learnerId,
        skillId: tag.skillId,
        masteryProbability: 0.95,
        attempts: 6,
        correctCount: 6,
      },
    });

    const warm = await shouldSkipLesson(f.learnerId, f.quizLessonId);
    expect(warm.shouldSkip).toBe(true);
  });

  it("AC-4.5: learner states carry the chapter they belong to", async () => {
    const f = await buildUntaggedCourse("grouping");
    const attemptId = await failAttempt(f);
    await updateLearnerStateFromAttempt(f.learnerId, attemptId);

    const { getLearnerSkillStates } = await import("../learnerState");
    const states = await getLearnerSkillStates(f.learnerId, undefined);

    expect(states).toHaveLength(1);
    expect(states[0]!.isAuto).toBe(true);
    expect(states[0]!.group).toMatchObject({
      courseId: f.courseId,
      moduleTitle: "Chương 1",
      lessonId: f.quizLessonId,
    });
  });
});
