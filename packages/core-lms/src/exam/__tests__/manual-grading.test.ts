import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { createCourse } from "../../courses/courses";
import { registerUser } from "../../auth/register";
import { enrollInCourse } from "../../learning/enroll";
import { CourseAuthzError } from "../../courses/authz";
import {
  createExam,
  createExamQuestion,
  gradeManualExamAnswer,
  listPendingExamGrades,
  publishExam,
  saveAnswer,
  startExamAttempt,
  submitExamAttempt,
} from "../";

const BASE = "http://localhost:3000";

const mcqConfig = () => ({
  options: [
    { id: "a", label: "A", isCorrect: true },
    { id: "b", label: "B", isCorrect: false },
  ],
});

async function setupWithEssay(slug: string) {
  const owner = await registerUser(
    { email: `mg-o-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `C ${slug}`,
    description: "x",
    slug: `mg-course-${slug}`,
  });
  await prisma.course.update({
    where: { id: course.courseId },
    data: { status: "published", publishedAt: new Date() },
  });
  const now = Date.now();
  const { examId } = await createExam(owner.userId, course.courseId, {
    title: "Exam",
    durationMin: 60,
    openAt: new Date(now - 60_000),
    closeAt: new Date(now + 7 * 24 * 60 * 60_000),
  });
  const skill = await prisma.skill.create({
    data: { code: `mg.${slug}`, name: "S" },
  });
  const mcq = await createExamQuestion(owner.userId, examId, {
    type: "mcq",
    prompt: "MCQ",
    config: mcqConfig(),
    points: 5,
    skillIds: [skill.id],
  });
  const essay = await createExamQuestion(owner.userId, examId, {
    type: "essay",
    prompt: "Discuss",
    config: { rubric: "x" },
    points: 10,
    skillIds: [skill.id],
  });
  await publishExam(owner.userId, examId);

  const learner = await registerUser(
    { email: `mg-l-${slug}@e.com`, password: "password1234", displayName: "L" },
    BASE,
  );
  await enrollInCourse(learner.userId, course.courseId);
  const start = await startExamAttempt(learner.userId, examId);
  await saveAnswer(learner.userId, start.attemptId, mcq.questionId, {
    answerJson: { optionIds: ["a"] },
    sessionToken: start.sessionToken,
  });
  await saveAnswer(learner.userId, start.attemptId, essay.questionId, {
    answerJson: { text: "An essay body" },
    sessionToken: start.sessionToken,
  });
  await submitExamAttempt(learner.userId, start.attemptId);

  const essayAnswer = await prisma.examAnswer.findUniqueOrThrow({
    where: {
      attemptId_questionId: {
        attemptId: start.attemptId,
        questionId: essay.questionId,
      },
    },
  });
  return {
    ownerId: owner.userId,
    courseId: course.courseId,
    examId,
    learnerId: learner.userId,
    attemptId: start.attemptId,
    essayAnswerId: essayAnswer.id,
    essayQuestionId: essay.questionId,
    mcqQuestionId: mcq.questionId,
  };
}

describe("listPendingExamGrades (A7.6.1)", () => {
  it("lists essay/short answers awaiting grade; orders by submittedAt asc", async () => {
    const a = await setupWithEssay("l1");
    const items = await listPendingExamGrades(a.ownerId, a.examId);
    expect(items).toHaveLength(1);
    expect(items[0]!.id).toBe(a.essayAnswerId);
    expect(items[0]!.question.type).toBe("essay");
    expect(items[0]!.attempt.user.email).toBe("mg-l-l1@e.com");
  });

  it("excludes answers already graded", async () => {
    const a = await setupWithEssay("l2");
    await gradeManualExamAnswer(a.ownerId, a.essayAnswerId, { manualScore: 7 });
    const items = await listPendingExamGrades(a.ownerId, a.examId);
    expect(items).toHaveLength(0);
  });

  it("rejects non-instructor", async () => {
    const a = await setupWithEssay("l3");
    const stranger = await registerUser(
      { email: "stranger-l3@e.com", password: "password1234", displayName: "X" },
      BASE,
    );
    await expect(
      listPendingExamGrades(stranger.userId, a.examId),
    ).rejects.toBeInstanceOf(CourseAuthzError);
  });
});

describe("gradeManualExamAnswer (A7.6.2)", () => {
  it("first grade finalizes attempt; emits exam.graded; writes history", async () => {
    const a = await setupWithEssay("g1");
    const r = await gradeManualExamAnswer(a.ownerId, a.essayAnswerId, {
      manualScore: 8,
      comment: "Good work",
    });
    expect(r.isInitial).toBe(true);
    expect(r.finalized).toBe(true);
    const attempt = await prisma.examAttempt.findUniqueOrThrow({
      where: { id: a.attemptId },
    });
    expect(attempt.status).toBe("graded");
    expect(attempt.score).toBe(13); // 5 mcq + 8 essay
    expect(attempt.scorePct).toBeCloseTo((13 / 15) * 100, 2);
    expect(attempt.passed).toBe(true);
    const history = await prisma.examGradeHistory.findFirstOrThrow({
      where: { answerId: a.essayAnswerId },
    });
    expect(history.oldScore).toBeNull();
    expect(history.newScore).toBe(8);
    const ev = await prisma.learningEvent.findFirst({
      where: { eventType: LearningEventType.ExamGraded, userId: a.learnerId },
    });
    expect(ev).not.toBeNull();
  });

  it("rejects score above question points", async () => {
    const a = await setupWithEssay("g2");
    await expect(
      gradeManualExamAnswer(a.ownerId, a.essayAnswerId, { manualScore: 11 }),
    ).rejects.toMatchObject({ code: "score_out_of_range" });
  });

  it("rejects when answer belongs to MCQ (auto-graded type)", async () => {
    const a = await setupWithEssay("g3");
    const mcqAnswer = await prisma.examAnswer.findUniqueOrThrow({
      where: {
        attemptId_questionId: {
          attemptId: a.attemptId,
          questionId: a.mcqQuestionId,
        },
      },
    });
    await expect(
      gradeManualExamAnswer(a.ownerId, mcqAnswer.id, { manualScore: 5 }),
    ).rejects.toMatchObject({ code: "not_manual_gradable" });
  });

  it("rejects non-instructor", async () => {
    const a = await setupWithEssay("g4");
    const stranger = await registerUser(
      { email: "stranger-g4@e.com", password: "password1234", displayName: "X" },
      BASE,
    );
    await expect(
      gradeManualExamAnswer(stranger.userId, a.essayAnswerId, { manualScore: 5 }),
    ).rejects.toBeInstanceOf(CourseAuthzError);
  });

  it("keeps attempt non-final when other essays still pending", async () => {
    // Add a second essay to the same exam by mutating DB directly — quicker
    // than re-running publish flow.
    const a = await setupWithEssay("g5");
    const skill = await prisma.skill.findFirstOrThrow({
      where: { code: "mg.g5" },
    });
    // Need a draft state to add a question — clone scenario: bypass via raw insert.
    const orderInExam =
      (await prisma.examQuestion.count({ where: { examId: a.examId } })) + 0;
    const extra = await prisma.examQuestion.create({
      data: {
        examId: a.examId,
        type: "essay",
        prompt: "Second essay",
        config: { rubric: "x" },
        points: 5,
        orderInExam,
      },
    });
    await prisma.examQuestionSkillTag.create({
      data: { questionId: extra.id, skillId: skill.id },
    });
    // Manually insert a pending answer for this question on the existing attempt.
    const extraAnswer = await prisma.examAnswer.create({
      data: {
        attemptId: a.attemptId,
        questionId: extra.id,
        answerJson: { text: "second" },
        needsGrading: true,
      },
    });
    const r = await gradeManualExamAnswer(a.ownerId, a.essayAnswerId, {
      manualScore: 6,
    });
    expect(r.finalized).toBe(false);
    const attempt = await prisma.examAttempt.findUniqueOrThrow({
      where: { id: a.attemptId },
    });
    expect(attempt.status).not.toBe("graded");
    expect(attempt.scorePct).toBeNull();
    // After grading the remaining essay too → finalize.
    await gradeManualExamAnswer(a.ownerId, extraAnswer.id, { manualScore: 3 });
    const final = await prisma.examAttempt.findUniqueOrThrow({
      where: { id: a.attemptId },
    });
    expect(final.status).toBe("graded");
    expect(final.score).toBe(5 + 6 + 3);
  });
});

describe("regrade (A7.6.3)", () => {
  it("updates score; emits exam.regraded with old/new; appends history", async () => {
    const a = await setupWithEssay("rg1");
    await gradeManualExamAnswer(a.ownerId, a.essayAnswerId, { manualScore: 7 });
    const r = await gradeManualExamAnswer(a.ownerId, a.essayAnswerId, {
      manualScore: 9,
      reason: "Stronger argument in 2nd reading",
    });
    expect(r.isInitial).toBe(false);
    expect(r.oldScore).toBe(7);
    expect(r.newScore).toBe(9);
    const attempt = await prisma.examAttempt.findUniqueOrThrow({
      where: { id: a.attemptId },
    });
    expect(attempt.score).toBe(14); // 5 + 9
    const history = await prisma.examGradeHistory.findMany({
      where: { answerId: a.essayAnswerId },
      orderBy: { changedAt: "asc" },
    });
    expect(history).toHaveLength(2);
    expect(history[1]!.oldScore).toBe(7);
    expect(history[1]!.newScore).toBe(9);
    expect(history[1]!.reason).toBe("Stronger argument in 2nd reading");
    const regrade = await prisma.learningEvent.findFirst({
      where: { eventType: LearningEventType.ExamRegraded },
    });
    expect(regrade).not.toBeNull();
    expect((regrade!.payload as { newScore: number }).newScore).toBe(9);
  });
});
