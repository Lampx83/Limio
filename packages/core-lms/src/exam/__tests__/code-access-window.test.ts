import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import {
  claimByAssignedCode,
  claimByOpenCode,
  createExam,
  createExamQuestion,
  createExamSession,
  createPassage,
  ensureDefaultSession,
  publishExam,
  setManualSessionOpen,
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
  return { examId, sessionId, ownerId: owner.userId };
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
      studentCode: "SV-001",
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
        studentCode: "SV-002",
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

describe("ca thủ công — GV bấm mở/đóng", () => {
  it("mở ngay khi tạo, không cần nhập giờ", async () => {
    const { examId, ownerId } = await setupPastExam("man-create");
    const { id } = await createExamSession(
      ownerId,
      examId,
      { timingMode: "manual" },
    );
    const row = await prisma.examSession.findUniqueOrThrow({ where: { id } });
    expect(row.timingMode).toBe("manual");
    expect(row.status).toBe("open");
    expect(row.closesAt).toBeNull();
  });

  it("học sinh vào được khi ca đang mở, dù cửa sổ của ĐỀ đã đóng từ hôm qua", async () => {
    const { examId, ownerId } = await setupPastExam("man-in");
    await prisma.exam.update({
      where: { id: examId },
      data: { accessMode: "open_code" },
    });
    const { id } = await createExamSession(
      ownerId,
      examId,
      { timingMode: "manual" },
    );
    await prisma.examSession.update({
      where: { id },
      data: { accessMode: "open_code", openCode: "MANOP1" },
    });

    const r = await claimByOpenCode("MANOP1", {
      displayName: "SV",
      studentCode: "SV-003",
      phone: "0900000001",
      email: "sv-man1@e.com",
    });
    expect(r.attemptId).toBeTruthy();
  });

  it("GV bấm đóng thì người vào sau bị chặn", async () => {
    const { examId, ownerId } = await setupPastExam("man-close");
    await prisma.exam.update({
      where: { id: examId },
      data: { accessMode: "open_code" },
    });
    const { id } = await createExamSession(ownerId, examId, { timingMode: "manual" });
    await prisma.examSession.update({
      where: { id },
      data: { accessMode: "open_code", openCode: "MANCL1" },
    });

    await setManualSessionOpen(ownerId, id, false);

    await expect(
      claimByOpenCode("MANCL1", {
        displayName: "SV2",
        studentCode: "SV-004",
        phone: "0900000002",
        email: "sv-man2@e.com",
      }),
    ).rejects.toMatchObject({ code: "exam_window_closed" });

    // Mở lại thì vào được tiếp.
    await setManualSessionOpen(ownerId, id, true);
    const r = await claimByOpenCode("MANCL1", {
      displayName: "SV3",
      studentCode: "SV-005",
      phone: "0900000003",
      email: "sv-man3@e.com",
    });
    expect(r.attemptId).toBeTruthy();
  });

  it("không cho bấm đóng tay một ca hẹn giờ", async () => {
    const { sessionId, ownerId } = await setupPastExam("man-guard");
    await expect(
      setManualSessionOpen(ownerId, sessionId, false),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("ca hẹn giờ tạo như cũ vẫn phải có đủ hai mốc", async () => {
    const { examId, ownerId } = await setupPastExam("man-req");
    await expect(
      createExamSession(ownerId, examId, {
        timingMode: "scheduled",
      }),
    ).rejects.toBeTruthy();
  });
});
