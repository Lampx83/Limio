import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { createCourse } from "../../courses/courses";
import { registerUser } from "../../auth/register";
import { enrollInCourse } from "../../learning/enroll";
import { CourseAuthzError } from "../../courses/authz";
import {
  createExam,
  createOralMaterialTopicList,
  ExamError,
  getOralEvaluation,
  publishExam,
  startOralExamAttempt,
  submitOralEvaluation,
} from "../";

const BASE = "http://localhost:3000";

async function setup(slug: string) {
  const owner = await registerUser(
    { email: `oev-o-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `Course ${slug}`,
    description: "x",
    slug: `oev-course-${slug}`,
  });
  await prisma.course.update({
    where: { id: course.courseId },
    data: { status: "published", publishedAt: new Date() },
  });
  const now = Date.now();
  const { examId } = await createExam(owner.userId, course.courseId, {
    title: "Vấn đáp",
    durationMin: 20,
    openAt: new Date(now - 60_000),
    closeAt: new Date(now + 7 * 24 * 60 * 60_000),
    kind: "oral",
  });
  await createOralMaterialTopicList(owner.userId, examId, { title: "Chủ đề", text: "x" });
  await publishExam(owner.userId, examId);

  const learner = await registerUser(
    { email: `oev-l-${slug}@e.com`, password: "password1234", displayName: "L" },
    BASE,
  );
  await enrollInCourse(learner.userId, course.courseId);
  const { attemptId } = await startOralExamAttempt(learner.userId, examId);
  await prisma.examAttempt.update({ where: { id: attemptId }, data: { status: "submitted" } });
  return { ownerId: owner.userId, courseId: course.courseId, examId, attemptId };
}

describe("submitOralEvaluation (A6.4)", () => {
  it("creates the evaluation with status=overridden when there is no AI suggestion yet", async () => {
    const s = await setup("g1");
    await submitOralEvaluation(s.ownerId, s.attemptId, { score: 75, notes: "Khá tốt" });
    const evaluation = await prisma.oralExamEvaluation.findUniqueOrThrow({
      where: { attemptId: s.attemptId },
    });
    expect(evaluation.instructorScore).toBe(75);
    expect(evaluation.instructorNotes).toBe("Khá tốt");
    expect(evaluation.status).toBe("overridden");
    expect(evaluation.gradedById).toBe(s.ownerId);

    const attempt = await prisma.examAttempt.findUniqueOrThrow({ where: { id: s.attemptId } });
    expect(attempt.status).toBe("graded");
  });

  it("marks status=approved when the instructor score matches the AI suggestion", async () => {
    const s = await setup("g2");
    await prisma.oralExamEvaluation.create({
      data: { attemptId: s.attemptId, aiSuggestedScore: 88 },
    });
    await submitOralEvaluation(s.ownerId, s.attemptId, { score: 88 });
    const evaluation = await prisma.oralExamEvaluation.findUniqueOrThrow({
      where: { attemptId: s.attemptId },
    });
    expect(evaluation.status).toBe("approved");
  });

  it("marks status=overridden when the instructor score differs from the AI suggestion", async () => {
    const s = await setup("g3");
    await prisma.oralExamEvaluation.create({
      data: { attemptId: s.attemptId, aiSuggestedScore: 88 },
    });
    await submitOralEvaluation(s.ownerId, s.attemptId, { score: 60 });
    const evaluation = await prisma.oralExamEvaluation.findUniqueOrThrow({
      where: { attemptId: s.attemptId },
    });
    expect(evaluation.status).toBe("overridden");
  });

  it("allows re-submitting to correct an already-graded attempt", async () => {
    const s = await setup("g4");
    await submitOralEvaluation(s.ownerId, s.attemptId, { score: 50 });
    await submitOralEvaluation(s.ownerId, s.attemptId, { score: 95, notes: "sửa lại" });
    const evaluation = await prisma.oralExamEvaluation.findUniqueOrThrow({
      where: { attemptId: s.attemptId },
    });
    expect(evaluation.instructorScore).toBe(95);
    expect(evaluation.instructorNotes).toBe("sửa lại");
  });

  it("rejects grading an attempt that is still in_progress", async () => {
    const s = await setup("g5");
    await prisma.examAttempt.update({ where: { id: s.attemptId }, data: { status: "in_progress" } });
    await expect(submitOralEvaluation(s.ownerId, s.attemptId, { score: 50 })).rejects.toMatchObject({
      code: "attempt_not_submitted",
    });
  });

  it("allows grading an attempt the timeout cron closed as auto_submitted", async () => {
    const s = await setup("g5b");
    await prisma.examAttempt.update({
      where: { id: s.attemptId },
      data: { status: "auto_submitted" },
    });
    await submitOralEvaluation(s.ownerId, s.attemptId, { score: 70 });
    const attempt = await prisma.examAttempt.findUniqueOrThrow({ where: { id: s.attemptId } });
    expect(attempt.status).toBe("graded");
  });

  it("rejects an outsider grading someone else's exam", async () => {
    const s = await setup("g6");
    const outsider = await registerUser(
      { email: "oev-outsider-g6@e.com", password: "password1234", displayName: "U" },
      BASE,
    );
    await expect(
      submitOralEvaluation(outsider.userId, s.attemptId, { score: 50 }),
    ).rejects.toBeInstanceOf(CourseAuthzError);
  });

  it("emits exam.oral_evaluation.graded", async () => {
    const s = await setup("g7");
    await submitOralEvaluation(s.ownerId, s.attemptId, { score: 70 });
    const ev = await prisma.learningEvent.findFirst({
      where: { eventType: LearningEventType.ExamOralEvaluationGraded, userId: s.ownerId },
    });
    expect(ev).not.toBeNull();
    expect((ev!.payload as Record<string, unknown>).instructorScore).toBe(70);
  });

  it("throws ExamError, not a generic Error, for an unknown attemptId", async () => {
    const s = await setup("g8");
    try {
      await submitOralEvaluation(s.ownerId, "00000000-0000-0000-0000-000000000000", { score: 50 });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ExamError);
    }
  });
});

describe("getOralEvaluation (A6.4)", () => {
  it("returns the transcript ordered and the current evaluation", async () => {
    const s = await setup("v1");
    await prisma.oralExamTurn.create({
      data: { attemptId: s.attemptId, role: "examiner", content: "Q1" },
    });
    await prisma.oralExamTurn.create({
      data: { attemptId: s.attemptId, role: "student", content: "A1" },
    });
    await submitOralEvaluation(s.ownerId, s.attemptId, { score: 80 });

    const view = await getOralEvaluation(s.ownerId, s.attemptId);
    expect(view.turns.map((t) => t.content)).toEqual(["Q1", "A1"]);
    expect(view.evaluation?.instructorScore).toBe(80);
  });

  it("returns evaluation=null when nothing has been graded yet", async () => {
    const s = await setup("v2");
    const view = await getOralEvaluation(s.ownerId, s.attemptId);
    expect(view.evaluation).toBeNull();
  });
});
