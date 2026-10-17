import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import {
  claimByAssignedCode,
  createExam,
  createExamQuestion,
  createPassage,
  ensureDefaultSession,
  publishExam,
  rotateExamSessionOpenCode,
  updateExamSession,
} from "../";

const BASE = "http://localhost:3000";

/**
 * Chế độ thi thuộc về CA (PR2.12). Trang ca thi đọc ExamSession.accessMode,
 * nên đổi chế độ / xoay mã phải ghi vào ca — và đường vào bằng mã cá nhân
 * phải tôn trọng chế độ của ca chứ không phải của Exam.
 */
async function setup(slug: string) {
  const owner = await registerUser(
    { email: `sam-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `Course ${slug}`,
    description: "x",
    slug: `sam-course-${slug}`,
  });
  await prisma.course.update({
    where: { id: course.courseId },
    data: { status: "published", publishedAt: new Date() },
  });
  const now = Date.now();
  const { examId } = await createExam(owner.userId, course.courseId, {
    title: "Exam",
    durationMin: 60,
    openAt: new Date(now - 60 * 60_000),
    closeAt: new Date(now + 24 * 60 * 60_000),
  });
  const { passageId } = await createPassage(owner.userId, examId, {
    title: "P",
    contentJson: { type: "doc", content: [] },
  });
  const skill = await prisma.skill.create({
    data: { code: `sam.skill.${slug}`, name: "S" },
  });
  await createExamQuestion(owner.userId, examId, {
    type: "mcq",
    prompt: "Q1",
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
  await prisma.examSession.update({
    where: { id: sessionId },
    data: {
      opensAt: new Date(now - 60 * 60_000),
      closesAt: new Date(now + 2 * 60 * 60_000),
    },
  });
  return { examId, sessionId, ownerId: owner.userId };
}

function code8(slug: string) {
  return `${slug}${Math.random().toString(36).slice(2)}`.toUpperCase().slice(0, 8).padEnd(8, "X");
}

describe("updateExamSession — đổi chế độ thi của ca", () => {
  it("sang Tự do thì ca có mã chung; về Theo phòng thì mã chung bị xoá", async () => {
    const { sessionId, ownerId } = await setup("switch");
    await updateExamSession(ownerId, sessionId, { accessMode: "open_code" });
    const open = await prisma.examSession.findUniqueOrThrow({ where: { id: sessionId } });
    expect(open.accessMode).toBe("open_code");
    expect(open.openCode).toMatch(/^[A-Z0-9]{6}$/);

    await updateExamSession(ownerId, sessionId, { accessMode: "assigned_code" });
    const back = await prisma.examSession.findUniqueOrThrow({ where: { id: sessionId } });
    expect(back.accessMode).toBe("assigned_code");
    expect(back.openCode).toBeNull();
  });

  it("chặn đổi khi ca đang có bài làm dở, ca khác của cùng đề không ảnh hưởng", async () => {
    const { examId, sessionId, ownerId } = await setup("guard");
    await prisma.examSession.update({
      where: { id: sessionId },
      data: { accessMode: "assigned_code" },
    });
    const accessCode = code8("GD");
    await prisma.examCandidate.create({
      data: { examId, sessionId, displayName: "SV", accessCode },
    });
    await claimByAssignedCode(accessCode); // tạo 1 attempt in_progress

    await expect(
      updateExamSession(ownerId, sessionId, { accessMode: "open_code" }),
    ).rejects.toMatchObject({ code: "exam_has_attempts" });

    // Gửi lại đúng chế độ hiện tại thì không phải "đổi" — không chặn.
    await updateExamSession(ownerId, sessionId, { accessMode: "assigned_code" });

    const other = await prisma.examSession.create({
      data: {
        examId,
        opensAt: new Date(Date.now() - 60_000),
        closesAt: new Date(Date.now() + 60 * 60_000),
      },
      select: { id: true },
    });
    await updateExamSession(ownerId, other.id, { accessMode: "open_code" });
    const row = await prisma.examSession.findUniqueOrThrow({ where: { id: other.id } });
    expect(row.accessMode).toBe("open_code");
  });
});

describe("rotateExamSessionOpenCode", () => {
  it("cấp mã mới cho ca Tự do", async () => {
    const { sessionId, ownerId } = await setup("rotate");
    await updateExamSession(ownerId, sessionId, { accessMode: "open_code" });
    const before = await prisma.examSession.findUniqueOrThrow({ where: { id: sessionId } });
    const { openCode } = await rotateExamSessionOpenCode(ownerId, sessionId);
    expect(openCode).not.toBe(before.openCode);
    const after = await prisma.examSession.findUniqueOrThrow({ where: { id: sessionId } });
    expect(after.openCode).toBe(openCode);
  });

  it("từ chối khi ca không ở chế độ Tự do", async () => {
    const { sessionId, ownerId } = await setup("rotate-no");
    await updateExamSession(ownerId, sessionId, { accessMode: "assigned_code" });
    await expect(rotateExamSessionOpenCode(ownerId, sessionId)).rejects.toMatchObject({
      code: "access_mode_mismatch",
    });
  });
});

describe("claimByAssignedCode — theo chế độ của ca", () => {
  it("ca Theo phòng vào được dù Exam còn ghi open_code", async () => {
    const { examId, sessionId } = await setup("claim-ok");
    await prisma.exam.update({ where: { id: examId }, data: { accessMode: "open_code" } });
    await prisma.examSession.update({
      where: { id: sessionId },
      data: { accessMode: "assigned_code" },
    });
    const accessCode = code8("OK");
    await prisma.examCandidate.create({
      data: { examId, sessionId, displayName: "SV", accessCode },
    });
    const r = await claimByAssignedCode(accessCode);
    expect(r.attemptId).toBeTruthy();
  });

  it("ca đã chuyển sang Tự do thì mã cá nhân bị chặn dù Exam còn ghi assigned_code", async () => {
    const { examId, sessionId } = await setup("claim-blocked");
    await prisma.exam.update({ where: { id: examId }, data: { accessMode: "assigned_code" } });
    await prisma.examSession.update({
      where: { id: sessionId },
      data: { accessMode: "open_code", openCode: code8("OC").slice(0, 6) },
    });
    const accessCode = code8("BL");
    await prisma.examCandidate.create({
      data: { examId, sessionId, displayName: "SV", accessCode },
    });
    await expect(claimByAssignedCode(accessCode)).rejects.toMatchObject({
      code: "access_mode_mismatch",
    });
  });
});
