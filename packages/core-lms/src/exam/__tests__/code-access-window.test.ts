import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import {
  claimByAssignedCode,
  claimByOpenCode,
  createExam,
  createExamQuestion,
  createPassage,
  ensureDefaultSession,
  publishExam,
} from "../";

const BASE = "http://localhost:3000";

const mcqConfig = () => ({
  options: [
    { id: "a", label: "A", isCorrect: true },
    { id: "b", label: "B", isCorrect: false },
  ],
});

/**
 * Published exam whose PARENT window (openAt/closeAt) is already in the past,
 * but whose default ca thi (ExamSession) has its own window — used to prove the
 * claim path checks the session window, not the exam window (PR2.12 regression).
 */
async function setupPastExam(slug: string) {
  const owner = await registerUser(
    { email: `caw-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `Course ${slug}`,
    description: "x",
    slug: `caw-course-${slug}`,
  });
  await prisma.course.update({
    where: { id: course.courseId },
    data: { status: "published", publishedAt: new Date() },
  });
  const now = Date.now();
  // Parent Exam window already closed yesterday.
  const { examId } = await createExam(owner.userId, course.courseId, {
    title: "Exam",
    durationMin: 60,
    openAt: new Date(now - 2 * 24 * 60 * 60_000),
    closeAt: new Date(now - 24 * 60 * 60_000),
  });
  const { passageId } = await createPassage(owner.userId, examId, {
    title: "P",
    contentJson: { type: "doc", content: [] },
  });
  const skill = await prisma.skill.create({
    data: { code: `caw.skill.${slug}`, name: "S" },
  });
  await createExamQuestion(owner.userId, examId, {
    type: "mcq",
    prompt: "Q1",
    config: mcqConfig(),
    passageId,
    skillIds: [skill.id],
  });
  await publishExam(owner.userId, examId);
  const sessionId = await ensureDefaultSession(examId);
  // Ca thi window is open right now (opened 1h ago, closes in 2h).
  await prisma.examSession.update({
    where: { id: sessionId },
    data: {
      opensAt: new Date(now - 60 * 60_000),
      closesAt: new Date(now + 2 * 60 * 60_000),
    },
  });
  return { examId, sessionId };
}

describe("code-access — claim uses the ca thi (ExamSession) window, not the parent Exam window", () => {
  it("open_code: session open lets the candidate in even though Exam.closeAt is in the past", async () => {
    const { examId, sessionId } = await setupPastExam("open-win");
    await prisma.exam.update({
      where: { id: examId },
      data: { accessMode: "open_code" },
    });
    await prisma.examSession.update({
      where: { id: sessionId },
      data: { accessMode: "open_code", openCode: "OPENWN" },
    });

    const r = await claimByOpenCode("OPENWN", {
      displayName: "SV",
      phone: "0900000000",
      email: "sv@e.com",
    });
    expect(r.attemptId).toBeTruthy();
  });

  it("open_code: session closed rejects with exam_window_closed even if Exam window is open", async () => {
    const { examId, sessionId } = await setupPastExam("open-closed");
    const now = Date.now();
    await prisma.exam.update({
      where: { id: examId },
      data: {
        accessMode: "open_code",
        // Exam window wide open...
        openAt: new Date(now - 60 * 60_000),
        closeAt: new Date(now + 24 * 60 * 60_000),
      },
    });
    await prisma.examSession.update({
      where: { id: sessionId },
      data: {
        accessMode: "open_code",
        openCode: "OPENCL",
        // ...but the ca thi already closed an hour ago.
        opensAt: new Date(now - 3 * 60 * 60_000),
        closesAt: new Date(now - 60 * 60_000),
      },
    });

    await expect(
      claimByOpenCode("OPENCL", {
        displayName: "SV",
        phone: "0900000000",
        email: "sv@e.com",
      }),
    ).rejects.toMatchObject({ code: "exam_window_closed" });
  });

  it("assigned_code: session open lets the candidate in even though Exam.closeAt is in the past", async () => {
    const { examId, sessionId } = await setupPastExam("assigned-win");
    await prisma.exam.update({
      where: { id: examId },
      data: { accessMode: "assigned_code" },
    });
    await prisma.examCandidate.create({
      data: { examId, sessionId, displayName: "SV", accessCode: "CANDWIN1" },
    });

    const r = await claimByAssignedCode("CANDWIN1");
    expect(r.attemptId).toBeTruthy();
  });
});
