import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { createCourse } from "../../courses/courses";
import { registerUser } from "../../auth/register";
import { enrollInCourse } from "../../learning/enroll";
import { createExam, createExamQuestion, createSection, publishExam, startExamAttempt } from "../";

/**
 * Publish chỉ làm đề SẴN SÀNG, không tự mở thi.
 *
 * Trước đây publish dựng ngầm một "Đợt thi tự động" + "Ca mặc định" cho học viên
 * ghi danh — nguồn của hàng chục đợt rác lẫn vào trang Đợt thi và tab Kỳ thi
 * chính thức. Giờ muốn cho thi thì giáo viên vào Tổ chức thi chọn một trong ba
 * hình thức. Riêng đề luyện thi (mock) không phải lần thi có tổ chức: học viên
 * ghi danh khoá là làm được, không cần ca.
 */

const BASE = "http://localhost:3000";
const MCQ = {
  type: "mcq" as const,
  prompt: "Q",
  config: {
    options: [
      { id: "a", label: "A", isCorrect: true },
      { id: "b", label: "B", isCorrect: false },
    ],
  },
};

async function setup(slug: string, opts: { mock: boolean; enroll?: boolean }) {
  const owner = await registerUser(
    { email: `pnas-o-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `C ${slug}`,
    description: "x",
    slug: `pnas-course-${slug}`,
  });
  await prisma.course.update({
    where: { id: course.courseId },
    data: { status: "published", publishedAt: new Date() },
  });
  const now = Date.now();
  const { examId } = await createExam(owner.userId, course.courseId, {
    title: opts.mock ? "Thi thử" : "Giữa kỳ",
    durationMin: 10,
    mockMode: opts.mock,
    openAt: new Date(now - 60_000),
    closeAt: new Date(now + 86_400_000),
  });
  if (opts.mock) {
    const { id: sectionId } = await createSection(owner.userId, examId, {
      title: "Nghe",
      durationMin: 10,
      languageSkill: "listening",
    });
    await createExamQuestion(owner.userId, examId, { ...MCQ, sectionId });
  } else {
    await createExamQuestion(owner.userId, examId, MCQ);
  }
  await publishExam(owner.userId, examId);
  const learner = await registerUser(
    { email: `pnas-l-${slug}@e.com`, password: "password1234", displayName: "L" },
    BASE,
  );
  if (opts.enroll !== false) await enrollInCourse(learner.userId, course.courseId);
  return { examId, learnerId: learner.userId };
}

describe("publish không tự mở thi", () => {
  it("Given đề thường có giờ mở/đóng, When publish, Then không có ca hay đợt nào được tạo", async () => {
    const { examId } = await setup("no-session", { mock: false });
    const exam = await prisma.exam.findUniqueOrThrow({ where: { id: examId } });
    expect(exam.status).toBe("published");
    expect(await prisma.examSession.count({ where: { examId } })).toBe(0);
  });

  it("Given đề thường đã publish nhưng chưa tổ chức, When học viên ghi danh vào thi, Then báo chưa mở", async () => {
    const { examId, learnerId } = await setup("not-open", { mock: false });
    await expect(startExamAttempt(learnerId, examId)).rejects.toMatchObject({
      code: "exam_not_open",
    });
  });
});

describe("luyện thi không cần ca", () => {
  it("Given đề luyện thi đã publish, When học viên ghi danh bắt đầu, Then làm được và lượt không gắn ca", async () => {
    const { examId, learnerId } = await setup("mock-ok", { mock: true });
    const { attemptId } = await startExamAttempt(learnerId, examId);
    const attempt = await prisma.examAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    expect(attempt.sessionId).toBeNull();
    expect(await prisma.examSession.count({ where: { examId } })).toBe(0);
  });

  it("Given đề luyện thi, When người CHƯA ghi danh bắt đầu, Then bị chặn", async () => {
    const { examId, learnerId } = await setup("mock-not-enrolled", { mock: true, enroll: false });
    await expect(startExamAttempt(learnerId, examId)).rejects.toMatchObject({
      code: "not_enrolled",
    });
  });
});
