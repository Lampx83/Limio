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

/** Published exam (durationMin) + its default ca thi (ExamSession). */
async function setup(slug: string, durationMin = 60) {
  const owner = await registerUser(
    { email: `ca-o-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `Course ${slug}`,
    description: "x",
    slug: `ca-course-${slug}`,
  });
  await prisma.course.update({
    where: { id: course.courseId },
    data: { status: "published", publishedAt: new Date() },
  });
  const now = Date.now();
  const { examId } = await createExam(owner.userId, course.courseId, {
    title: "Exam",
    durationMin,
    openAt: new Date(now - 60_000),
    closeAt: new Date(now + 7 * 24 * 60 * 60_000),
  });
  const { passageId } = await createPassage(owner.userId, examId, {
    title: "P",
    contentJson: { type: "doc", content: [] },
  });
  const skill = await prisma.skill.create({
    data: { code: `ca.skill.${slug}`, name: "S" },
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
  return { examId, sessionId };
}

async function durationSecOf(attemptId: string): Promise<number> {
  const a = await prisma.examAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    select: { durationSec: true },
  });
  return a.durationSec;
}

describe("code-access — ca thi durationOverrideMin governs the countdown", () => {
  it("assigned_code: ca thi override (20p) wins over Exam.durationMin (60p)", async () => {
    const { examId, sessionId } = await setup("assigned-ovr", 60);
    await prisma.exam.update({
      where: { id: examId },
      data: { accessMode: "assigned_code" },
    });
    await prisma.examSession.update({
      where: { id: sessionId },
      data: { durationOverrideMin: 20 },
    });
    await prisma.examCandidate.create({
      data: { examId, sessionId, displayName: "SV", accessCode: "CANDCODE1" },
    });

    const r = await claimByAssignedCode("CANDCODE1");
    expect(await durationSecOf(r.attemptId)).toBe(20 * 60);
  });

  it("assigned_code: no override → falls back to Exam.durationMin (60p)", async () => {
    const { examId, sessionId } = await setup("assigned-noovr", 60);
    await prisma.exam.update({
      where: { id: examId },
      data: { accessMode: "assigned_code" },
    });
    await prisma.examCandidate.create({
      data: { examId, sessionId, displayName: "SV", accessCode: "CANDCODE2" },
    });

    const r = await claimByAssignedCode("CANDCODE2");
    expect(await durationSecOf(r.attemptId)).toBe(60 * 60);
  });

  it("open_code: ca thi override (20p) wins over Exam.durationMin (60p)", async () => {
    const { examId, sessionId } = await setup("open-ovr", 60);
    await prisma.exam.update({
      where: { id: examId },
      data: { accessMode: "open_code" },
    });
    await prisma.examSession.update({
      where: { id: sessionId },
      data: { accessMode: "open_code", openCode: "OPEN01", durationOverrideMin: 20 },
    });

    const r = await claimByOpenCode("OPEN01", {
      displayName: "SV",
      phone: "0900000000",
      email: "sv@e.com",
    });
    expect(await durationSecOf(r.attemptId)).toBe(20 * 60);
  });
});
