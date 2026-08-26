import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import { enrollInCourse } from "../../learning/enroll";
import {
  createExam,
  createExamQuestion,
  ensureDefaultSession,
  publishExam,
  startExamAttempt,
} from "../";

const BASE = "http://localhost:3000";

const mcq = () => ({
  options: [
    { id: "a", label: "A", isCorrect: true },
    { id: "b", label: "B", isCorrect: false },
  ],
});

async function setup(slug: string) {
  const owner = await registerUser(
    { email: `rp-${slug}@e.com`, password: "password1234", displayName: "GV" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `C ${slug}`,
    description: "x",
    slug: `rp-course-${slug}`,
  });
  await prisma.course.update({
    where: { id: course.courseId },
    data: { status: "published", publishedAt: new Date() },
  });
  const { examId } = await createExam(owner.userId, course.courseId, {
    title: `Đề ${slug}`,
    durationMin: 20,
  });
  await createExamQuestion(owner.userId, examId, {
    type: "mcq",
    prompt: "Q",
    config: mcq(),
    points: 10,
  });
  await publishExam(owner.userId, examId);

  const learner = await registerUser(
    { email: `rp-hs-${slug}@e.com`, password: "password1234", displayName: "HS" },
    BASE,
  );
  await enrollInCourse(learner.userId, course.courseId);

  return {
    ownerId: owner.userId,
    learnerId: learner.userId,
    courseId: course.courseId,
    examId,
  };
}

describe("bài làm nhớ ca thi của nó", () => {
  it("startExamAttempt ghi sessionId, không để trống", async () => {
    const s = await setup("link");
    const sessionId = await ensureDefaultSession(s.examId);
    await prisma.examSession.update({
      where: { id: sessionId },
      data: { status: "open", timingMode: "manual" },
    });

    const { attemptId } = await startExamAttempt(s.learnerId, s.examId);

    const a = await prisma.examAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      select: { sessionId: true },
    });
    // Không lưu thì lúc xem lại phải đoán lại ca — mà ca có thể đã đổi.
    expect(a.sessionId).toBe(sessionId);
  });
});

describe("chính sách lộ đáp án đi theo CA, không theo gói đề", () => {
  it("hai ca cùng một gói đề đặt khác nhau thì không đụng nhau", async () => {
    const s = await setup("haica");

    const caA = await ensureDefaultSession(s.examId);
    await prisma.examSession.update({
      where: { id: caA },
      data: { revealAnswers: "immediately" },
    });

    const caB = await prisma.examSession.create({
      data: {
        examId: s.examId,
        roundId: (
          await prisma.examSession.findUniqueOrThrow({
            where: { id: caA },
            select: { roundId: true },
          })
        ).roundId,
        opensAt: new Date(),
        closesAt: new Date(Date.now() + 3_600_000),
        revealAnswers: "never",
      },
      select: { id: true, revealAnswers: true },
    });

    const a = await prisma.examSession.findUniqueOrThrow({
      where: { id: caA },
      select: { revealAnswers: true },
    });
    expect(a.revealAnswers).toBe("immediately");
    expect(caB.revealAnswers).toBe("never");

    // Và gói đề không bị ai sửa trong lúc đó.
    const exam = await prisma.exam.findUniqueOrThrow({
      where: { id: s.examId },
      select: { showResultsAfterSubmit: true },
    });
    expect(exam.showResultsAfterSubmit).toBe(true);
  });

  it("xoá ca thi KHÔNG kéo bài làm đi theo", async () => {
    const s = await setup("xoaca");
    const sessionId = await ensureDefaultSession(s.examId);
    await prisma.examSession.update({
      where: { id: sessionId },
      data: { status: "open", timingMode: "manual" },
    });
    const { attemptId } = await startExamAttempt(s.learnerId, s.examId);

    await prisma.examCandidate.deleteMany({ where: { sessionId } });
    await prisma.examRoom.deleteMany({ where: { sessionId } });
    await prisma.examSession.delete({ where: { id: sessionId } });

    // Bài làm là bằng chứng — mất là mất điểm của học sinh. SetNull, không Cascade.
    const a = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      select: { id: true, sessionId: true },
    });
    expect(a).not.toBeNull();
    expect(a!.sessionId).toBeNull();
  });
});
