import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { createCourse } from "../../courses/courses";
import { registerUser } from "../../auth/register";
import { enrollInCourse } from "../../learning/enroll";
import {
  createExam,
  createExamQuestion,
  createSection,
  endCurrentSection,
  listMockExamsForLearner,
  publishExam,
  startExamAttempt,
  updateExam,
} from "../";

/**
 * LANG G5c.4 / G5c.7 — đề thi thử làm được nhiều lượt (mỗi lượt độc lập, bắt đầu lượt mới
 * có chủ ý bằng retake); công tắc "Cho thi thử" chặn lượt MỚI nhưng không cắt lượt đang làm dở.
 * Đề thường giữ nguyên (một lượt).
 */

const BASE = "http://localhost:3000";
const MCQ = {
  type: "mcq" as const,
  prompt: "Q",
  config: { options: [{ id: "a", label: "A", isCorrect: true }, { id: "b", label: "B", isCorrect: false }] },
};

async function setup(slug: string, mock = true) {
  const owner = await registerUser({ email: `rt-o-${slug}@e.com`, password: "password1234", displayName: "O" }, BASE);
  const course = await createCourse(owner.userId, { title: `C ${slug}`, description: "x", slug: `rt-course-${slug}` });
  await prisma.course.update({ where: { id: course.courseId }, data: { status: "published", publishedAt: new Date() } });
  const { examId } = await createExam(owner.userId, course.courseId, { title: "Thi thử", durationMin: 10, mockMode: mock });
  const { id: sectionId } = await createSection(owner.userId, examId, { title: "Nghe", durationMin: 10, languageSkill: "listening" });
  await createExamQuestion(owner.userId, examId, { ...MCQ, sectionId });
  await publishExam(owner.userId, examId);
  const learner = await registerUser({ email: `rt-l-${slug}@e.com`, password: "password1234", displayName: "L" }, BASE);
  await enrollInCourse(learner.userId, course.courseId);
  return { ownerId: owner.userId, courseId: course.courseId, examId, learnerId: learner.userId, subject: { kind: "user" as const, userId: learner.userId } };
}

describe("thi lại đề thi thử (G5c.4)", () => {
  it("lượt đầu → nộp → mở lại KHÔNG có retake báo đã nộp (để chuyển sang kết quả, không đốt lượt)", async () => {
    const s = await setup("noretake");
    const a = await startExamAttempt(s.learnerId, s.examId);
    await endCurrentSection(s.subject, a.attemptId);
    await expect(startExamAttempt(s.learnerId, s.examId)).rejects.toMatchObject({ code: "attempt_already_submitted" });
    expect(await prisma.examAttempt.count({ where: { examId: s.examId, userId: s.learnerId } })).toBe(1);
  });

  it("có retake: tạo lượt MỚI độc lập (id, sessionToken, giờ bắt đầu riêng); lượt cũ giữ nguyên", async () => {
    const s = await setup("retake");
    const a = await startExamAttempt(s.learnerId, s.examId);
    await endCurrentSection(s.subject, a.attemptId);
    const b = await startExamAttempt(s.learnerId, s.examId, undefined, { retake: true });
    expect(b.attemptId).not.toBe(a.attemptId);
    expect(b.resumed).toBe(false);
    const rows = await prisma.examAttempt.findMany({ where: { examId: s.examId, userId: s.learnerId }, orderBy: { startedAt: "asc" } });
    expect(rows).toHaveLength(2);
    expect(rows[0]!.status).not.toBe("in_progress");
    expect(rows[1]!.status).toBe("in_progress");
  });

  it("đang có lượt dở: retake KHÔNG tạo lượt thứ hai song song, mà tiếp tục lượt đang làm", async () => {
    const s = await setup("resume");
    const a = await startExamAttempt(s.learnerId, s.examId);
    const b = await startExamAttempt(s.learnerId, s.examId, undefined, { retake: true });
    expect(b.attemptId).toBe(a.attemptId);
    expect(b.resumed).toBe(true);
  });

  it("nhiều lượt: chọn đúng lượt đang làm dở dù có lượt cũ đã nộp", async () => {
    const s = await setup("pickright");
    const a = await startExamAttempt(s.learnerId, s.examId);
    await endCurrentSection(s.subject, a.attemptId);
    const b = await startExamAttempt(s.learnerId, s.examId, undefined, { retake: true });
    const again = await startExamAttempt(s.learnerId, s.examId); // mở lại link
    expect(again.attemptId).toBe(b.attemptId);
    expect(again.resumed).toBe(true);
  });

  it("danh sách 'Luyện thi': số lượt đã thi và lượt gần nhất", async () => {
    const s = await setup("count");
    const a = await startExamAttempt(s.learnerId, s.examId);
    await endCurrentSection(s.subject, a.attemptId);
    const b = await startExamAttempt(s.learnerId, s.examId, undefined, { retake: true });
    await endCurrentSection(s.subject, b.attemptId);
    const [card] = await listMockExamsForLearner(s.learnerId, s.courseId);
    expect(card!.attemptCount).toBe(2);
    expect(card!.attempt!.attemptId).toBe(b.attemptId);
  });

  it("đề thường: retake không có tác dụng — vẫn một lượt", async () => {
    const s = await setup("regular", false);
    const a = await startExamAttempt(s.learnerId, s.examId);
    await prisma.examAttempt.update({ where: { id: a.attemptId }, data: { status: "submitted", submittedAt: new Date() } });
    await expect(startExamAttempt(s.learnerId, s.examId, undefined, { retake: true })).rejects.toMatchObject({
      code: "attempt_already_submitted",
    });
  });
});

describe("không cấp XP (G5c.8)", () => {
  it("thi thử và nộp bài không tạo giao dịch XP nào cho học viên", async () => {
    const s = await setup("noxp");
    const a = await startExamAttempt(s.learnerId, s.examId);
    await endCurrentSection(s.subject, a.attemptId);
    expect(await prisma.xpTransaction.count({ where: { userId: s.learnerId } })).toBe(0);
  });
});

describe("công tắc 'Cho thi thử' (G5c.7)", () => {
  it("tắt: không bắt đầu được lượt MỚI (mock_disabled); đề vẫn hiện (cho luyện đề) và chỉ biến mất khi tắt cả luyện đề", async () => {
    const s = await setup("off");
    await updateExam(s.ownerId, s.examId, { allowMock: false });
    await expect(startExamAttempt(s.learnerId, s.examId)).rejects.toMatchObject({ code: "mock_disabled" });
    expect((await listMockExamsForLearner(s.learnerId, s.courseId))[0]).toMatchObject({ allowMock: false, allowPractice: true });
    await updateExam(s.ownerId, s.examId, { allowPractice: false });
    expect(await listMockExamsForLearner(s.learnerId, s.courseId)).toEqual([]);
  });

  it("tắt khi học viên đang làm dở: vẫn tiếp tục được lượt đó (không cắt ngang giữa chừng)", async () => {
    const s = await setup("off-midway");
    const a = await startExamAttempt(s.learnerId, s.examId);
    await updateExam(s.ownerId, s.examId, { allowMock: false });
    const again = await startExamAttempt(s.learnerId, s.examId);
    expect(again.attemptId).toBe(a.attemptId);
  });

  it("bật lại thì bắt đầu được; đổi công tắc được cả khi đề đã xuất bản và đã có lượt thi", async () => {
    const s = await setup("toggle");
    await startExamAttempt(s.learnerId, s.examId);
    await updateExam(s.ownerId, s.examId, { allowMock: false });
    await updateExam(s.ownerId, s.examId, { allowMock: true });
    expect((await prisma.exam.findUniqueOrThrow({ where: { id: s.examId } })).allowMock).toBe(true);
  });
});
