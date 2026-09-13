import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { createCourse } from "../../courses/courses";
import { registerUser } from "../../auth/register";
import { enrollInCourse } from "../../learning/enroll";
import {
  createExam,
  createOralMaterialTopicList,
  ExamError,
  publishExam,
  startOralExamAttempt,
} from "../";

const BASE = "http://localhost:3000";

async function publishedOralExamSetup(slug: string, durationMin = 20) {
  const owner = await registerUser(
    { email: `oa-o-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `Course ${slug}`,
    description: "x",
    slug: `oa-course-${slug}`,
  });
  await prisma.course.update({
    where: { id: course.courseId },
    data: { status: "published", publishedAt: new Date() },
  });
  const now = Date.now();
  const { examId } = await createExam(owner.userId, course.courseId, {
    title: "Vấn đáp",
    durationMin,
    openAt: new Date(now - 60_000),
    closeAt: new Date(now + 7 * 24 * 60 * 60_000),
    kind: "oral",
  });
  await createOralMaterialTopicList(owner.userId, examId, {
    title: "Chủ đề",
    text: "Vòng lặp, đệ quy.",
  });
  await publishExam(owner.userId, examId);

  const learner = await registerUser(
    { email: `oa-l-${slug}@e.com`, password: "password1234", displayName: "L" },
    BASE,
  );
  await enrollInCourse(learner.userId, course.courseId);
  return { ownerId: owner.userId, courseId: course.courseId, examId, learnerId: learner.userId };
}

describe("startOralExamAttempt (A6.3)", () => {
  it("creates an in_progress attempt and emits exam.started", async () => {
    const s = await publishedOralExamSetup("s1", 20);
    const r = await startOralExamAttempt(s.learnerId, s.examId);
    expect(r.resumed).toBe(false);
    expect(r.durationSec).toBe(20 * 60);

    const attempt = await prisma.examAttempt.findUniqueOrThrow({ where: { id: r.attemptId } });
    expect(attempt.status).toBe("in_progress");
    expect(attempt.userId).toBe(s.learnerId);

    const ev = await prisma.learningEvent.findFirst({
      where: { eventType: LearningEventType.ExamStarted, userId: s.learnerId },
    });
    expect(ev).not.toBeNull();
  });

  it("resumes the same in_progress attempt on a second call", async () => {
    const s = await publishedOralExamSetup("s2");
    const first = await startOralExamAttempt(s.learnerId, s.examId);
    const second = await startOralExamAttempt(s.learnerId, s.examId);
    expect(second.resumed).toBe(true);
    expect(second.attemptId).toBe(first.attemptId);
  });

  it("rejects a learner who is not enrolled", async () => {
    const s = await publishedOralExamSetup("s3");
    const outsider = await registerUser(
      { email: "oa-outsider-s3@e.com", password: "password1234", displayName: "U" },
      BASE,
    );
    await expect(startOralExamAttempt(outsider.userId, s.examId)).rejects.toMatchObject({
      code: "not_enrolled",
    });
  });

  it("rejects a written exam with exam_not_oral", async () => {
    const owner = await registerUser(
      { email: "oa-owner-s4@e.com", password: "password1234", displayName: "O" },
      BASE,
    );
    const course = await createCourse(owner.userId, {
      title: "C s4",
      description: "x",
      slug: "oa-course-s4",
    });
    const { examId } = await createExam(owner.userId, course.courseId, {
      title: "Written",
      durationMin: 20,
    });
    await expect(startOralExamAttempt(owner.userId, examId)).rejects.toMatchObject({
      code: "exam_not_oral",
    });
  });

  it("rejects starting again once the attempt is already submitted", async () => {
    const s = await publishedOralExamSetup("s5");
    const first = await startOralExamAttempt(s.learnerId, s.examId);
    await prisma.examAttempt.update({
      where: { id: first.attemptId },
      data: { status: "submitted", submittedAt: new Date() },
    });
    await expect(startOralExamAttempt(s.learnerId, s.examId)).rejects.toMatchObject({
      code: "attempt_already_submitted",
    });
  });
});
