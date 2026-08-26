import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import { createExam, createExamQuestion, shareExamLink } from "../";

const BASE = "http://localhost:3000";

const mcq = () => ({
  options: [
    { id: "a", label: "A", isCorrect: true },
    { id: "b", label: "B", isCorrect: false },
  ],
});

async function setup(slug: string) {
  const owner = await registerUser(
    { email: `qsr-${slug}@e.com`, password: "password1234", displayName: "GV" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `C ${slug}`,
    description: "x",
    slug: `qsr-course-${slug}`,
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

describe("shareExamLink — dùng lại ca cũ", () => {
  it("bấm hai lần liên tiếp thì giữ nguyên mã (ca còn mở)", async () => {
    const s = await setup("hailan");
    const a = await shareExamLink(s.ownerId, s.examId);
    const b = await shareExamLink(s.ownerId, s.examId);

    expect(b.code).toBe(a.code);
    expect(b.sessionId).toBe(a.sessionId);
    expect(b.reusedExistingCode).toBe(true);
  });

  it("ca cũ ĐÃ ĐÓNG thì mở buổi MỚI, không trả lại mã chết", async () => {
    const s = await setup("dadong");
    const cu = await shareExamLink(s.ownerId, s.examId);
    await prisma.examSession.update({
      where: { id: cu.sessionId },
      data: { status: "closed" },
    });

    const moi = await shareExamLink(s.ownerId, s.examId);

    // Đây chính là lỗi user gặp trên production: bản cũ lấy ca CŨ NHẤT bất kể
    // đóng/mở, nên giáo viên tưởng vừa mở buổi mới mà học sinh vào báo
    // "đề đã đóng".
    expect(moi.sessionId).not.toBe(cu.sessionId);
    expect(moi.code).not.toBe(cu.code);
    expect(moi.reusedExistingCode).toBe(false);

    const s2 = await prisma.examSession.findUniqueOrThrow({
      where: { id: moi.sessionId },
      select: { status: true },
    });
    expect(s2.status).toBe("open");
  });

  it("ca hẹn giờ đã hết hạn cũng không được dùng lại", async () => {
    const s = await setup("hethan");
    const past = await shareExamLink(s.ownerId, s.examId, {
      timingMode: "scheduled",
      opensAt: new Date(Date.now() - 7_200_000),
      closesAt: new Date(Date.now() - 3_600_000),
    });

    const moi = await shareExamLink(s.ownerId, s.examId);
    expect(moi.sessionId).not.toBe(past.sessionId);
  });

  it("dùng lại ca đang mở thì ÁP thiết lập vừa chọn, không nuốt mất", async () => {
    const s = await setup("apsetting");
    const a = await shareExamLink(s.ownerId, s.examId, { durationMin: 15 });
    const b = await shareExamLink(s.ownerId, s.examId, {
      durationMin: 45,
      revealAnswers: "never",
    });
    expect(b.sessionId).toBe(a.sessionId);

    const row = await prisma.examSession.findUniqueOrThrow({
      where: { id: a.sessionId },
      select: { durationOverrideMin: true, revealAnswers: true },
    });
    // Bản cũ trả về sớm trước khi ghi gì — GV đổi thời lượng, thấy báo thành
    // công, mà không có gì đổi.
    expect(row.durationOverrideMin).toBe(45);
    expect(row.revealAnswers).toBe("never");
  });

  it("đổi từ mở-ngay sang hẹn giờ thì tạo ca mới, không nuốt mốc giờ", async () => {
    const s = await setup("doikieu");
    const thuCong = await shareExamLink(s.ownerId, s.examId);

    const opensAt = new Date(Date.now() + 3_600_000);
    const closesAt = new Date(Date.now() + 7_200_000);
    const henGio = await shareExamLink(s.ownerId, s.examId, {
      timingMode: "scheduled",
      opensAt,
      closesAt,
    });

    expect(henGio.sessionId).not.toBe(thuCong.sessionId);
    const row = await prisma.examSession.findUniqueOrThrow({
      where: { id: henGio.sessionId },
      select: { timingMode: true, closesAt: true },
    });
    expect(row.timingMode).toBe("scheduled");
    expect(row.closesAt).not.toBeNull();
  });
});
