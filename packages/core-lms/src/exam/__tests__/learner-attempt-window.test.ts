import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { createCourse } from "../../courses/courses";
import { registerUser } from "../../auth/register";
import { enrollInCourse } from "../../learning/enroll";
import {
  createExam,
  createExamQuestion,
  createPassage,
  ensureDefaultSession,
  publishExam,
  startExamAttempt,
} from "../";
import { EXAM_CLOSE_GRACE_SEC } from "../session-window";

const BASE = "http://localhost:3000";

async function setup(slug: string) {
  const owner = await registerUser(
    { email: `law-o-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `Course ${slug}`,
    description: "x",
    slug: `law-course-${slug}`,
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
    closeAt: new Date(now + 7 * 86_400_000),
  });
  const { passageId } = await createPassage(owner.userId, examId, {
    title: "P",
    contentJson: { type: "doc", content: [] },
  });
  const skill = await prisma.skill.create({ data: { code: `law.skill.${slug}`, name: "S" } });
  await createExamQuestion(owner.userId, examId, {
    type: "mcq",
    prompt: "Q",
    config: {
      options: [
        { id: "a", label: "A", isCorrect: true },
        { id: "b", label: "B", isCorrect: false },
      ],
    },
    passageId,
    skillIds: [skill.id],
  });
  await publishExam(owner.userId, examId);
  const sessionId = await ensureDefaultSession(examId);
  const learner = await registerUser(
    { email: `law-l-${slug}@e.com`, password: "password1234", displayName: "L" },
    BASE,
  );
  await enrollInCourse(learner.userId, course.courseId);
  return { examId, sessionId, learnerId: learner.userId };
}

const setWindow = (sessionId: string, opensMinAgo: number, closesInMin: number) =>
  prisma.examSession.update({
    where: { id: sessionId },
    data: {
      opensAt: new Date(Date.now() - opensMinAgo * 60_000),
      closesAt: new Date(Date.now() + closesInMin * 60_000),
    },
  });

describe("học viên đăng nhập — bài đã có và giờ đóng ca", () => {
  it("đã nộp rồi mở lại sau giờ đóng: báo 'đã nộp' (để chuyển sang kết quả), không báo 'đã đóng'", async () => {
    const { examId, sessionId, learnerId } = await setup("submitted");
    await setWindow(sessionId, 60, 30);
    const { attemptId } = await startExamAttempt(learnerId, examId);
    await prisma.examAttempt.update({
      where: { id: attemptId },
      data: { status: "submitted", submittedAt: new Date() },
    });
    await setWindow(sessionId, 120, -30); // ca đã đóng

    await expect(startExamAttempt(learnerId, examId)).rejects.toMatchObject({
      code: "attempt_already_submitted",
    });
  });

  it("đang làm dở, ca đã đóng: vẫn vào lại được bài của mình", async () => {
    const { examId, sessionId, learnerId } = await setup("resume");
    await setWindow(sessionId, 60, 30);
    const first = await startExamAttempt(learnerId, examId);
    await setWindow(sessionId, 120, -1);

    const again = await startExamAttempt(learnerId, examId);
    expect(again.resumed).toBe(true);
    expect(again.attemptId).toBe(first.attemptId);
  });

  it("chưa có bài mà ca đã đóng: vẫn báo đã đóng", async () => {
    const { examId, sessionId, learnerId } = await setup("closed");
    await setWindow(sessionId, 120, -30);
    await expect(startExamAttempt(learnerId, examId)).rejects.toMatchObject({
      code: "exam_window_closed",
    });
  });

  it("bắt đầu lúc còn 10 phút: thời hạn bị cắt theo giờ đóng ca", async () => {
    const { examId, sessionId, learnerId } = await setup("cap");
    await setWindow(sessionId, 60, 10);
    const r = await startExamAttempt(learnerId, examId);
    expect(r.durationSec).toBeLessThanOrEqual(10 * 60 + EXAM_CLOSE_GRACE_SEC);
    expect(r.durationSec).toBeGreaterThan(9 * 60);
  });
});
