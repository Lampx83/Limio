import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import {
  createExam,
  createExamQuestion,
  listExamRuns,
  shareExamLink,
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
    { email: `sp-${slug}@e.com`, password: "password1234", displayName: "GV" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `C ${slug}`,
    description: "x",
    slug: `sp-course-${slug}`,
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
  return { ownerId: owner.userId, examId };
}

describe("thử nghiệm là tính chất của BUỔI THI", () => {
  it("gói đề thường vẫn mở được đợt thử nghiệm", async () => {
    const s = await setup("dethuong");
    // Gói đề để mặc định = assessment, đúng như mọi gói đề tạo qua UI.
    const exam = await prisma.exam.findUniqueOrThrow({
      where: { id: s.examId },
      select: { purpose: true },
    });
    expect(exam.purpose).toBe("assessment");

    const shared = await shareExamLink(s.ownerId, s.examId, {
      purpose: "field_test",
    });

    // Đây chính là lỗi user gặp: trước đây lọc thẳng exam.purpose nên buổi
    // này không bao giờ hiện ở lịch sử thử nghiệm.
    const thuNghiem = await listExamRuns(s.ownerId, {
      purpose: "field_test",
      scale: "simple",
    });
    expect(thuNghiem.some((r) => r.sessionId === shared.sessionId)).toBe(true);

    // Và nó KHÔNG lẫn sang lịch sử thi thật.
    const thiThat = await listExamRuns(s.ownerId, {
      purpose: "assessment",
      scale: "simple",
    });
    expect(thiThat.some((r) => r.sessionId === shared.sessionId)).toBe(false);

    // Gói đề không bị sửa gì — nó vẫn là đề thi thật.
    const sau = await prisma.exam.findUniqueOrThrow({
      where: { id: s.examId },
      select: { purpose: true },
    });
    expect(sau.purpose).toBe("assessment");
  });

  it("buổi không khai mục đích thì tính theo gói đề", async () => {
    const s = await setup("kethua");
    await prisma.exam.update({
      where: { id: s.examId },
      data: { purpose: "field_test" },
    });
    const shared = await shareExamLink(s.ownerId, s.examId);

    const row = await prisma.examSession.findUniqueOrThrow({
      where: { id: shared.sessionId },
      select: { purpose: true },
    });
    expect(row.purpose).toBeNull();

    const ft = await listExamRuns(s.ownerId, {
      purpose: "field_test",
      scale: "simple",
    });
    expect(ft.some((r) => r.sessionId === shared.sessionId)).toBe(true);
  });

  it("cùng gói đề mở được cả buổi thử nghiệm lẫn buổi thi thật", async () => {
    const s = await setup("caihai");
    const thu = await shareExamLink(s.ownerId, s.examId, {
      purpose: "field_test",
    });
    // Buổi thử vẫn đang mở; mở tiếp buổi thi thật phải ra ca KHÁC, không
    // được dùng lại rồi lặng lẽ đổi loại buổi đang chạy.
    const that = await shareExamLink(s.ownerId, s.examId, {
      purpose: "assessment",
    });
    expect(that.sessionId).not.toBe(thu.sessionId);

    const ft = await listExamRuns(s.ownerId, { purpose: "field_test" });
    const asm = await listExamRuns(s.ownerId, { purpose: "assessment" });
    expect(ft.some((r) => r.sessionId === thu.sessionId)).toBe(true);
    expect(ft.some((r) => r.sessionId === that.sessionId)).toBe(false);
    expect(asm.some((r) => r.sessionId === that.sessionId)).toBe(true);
    expect(asm.some((r) => r.sessionId === thu.sessionId)).toBe(false);
  });
});
