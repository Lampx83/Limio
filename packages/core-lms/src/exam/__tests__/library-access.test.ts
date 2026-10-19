import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { createCourse } from "../../courses/courses";
import { registerUser } from "../../auth/register";
import {
  createExam,
  createExamQuestion,
  createSection,
  getPracticeOverview,
  publishExam,
  startExamAttempt,
  startPracticeSession,
  updateExam,
} from "../";
import { ExamError } from "../types";

/**
 * LANG L6.1/L6.5 — học thử miễn phí trong khoá luyện đề: người CHƯA ghi danh làm được đề đánh dấu `freePreview`
 * (cả luyện đề lẫn thi thử); mọi đề khác vẫn đòi ghi danh. Cờ chỉ có tác dụng ở khoá `practice_bank`.
 */

const BASE = "http://localhost:3000";
const MCQ = {
  type: "mcq" as const,
  prompt: "Q",
  config: { options: [{ id: "a", label: "A", isCorrect: true }, { id: "b", label: "B", isCorrect: false }] },
};

async function setup(slug: string, kind: "practice_bank" | "standard" = "practice_bank") {
  const owner = await registerUser({ email: `la-o-${slug}@e.com`, password: "password1234", displayName: "O" }, BASE);
  const course = await createCourse(owner.userId, { title: `C ${slug}`, description: "x", slug: `la-course-${slug}` });
  await prisma.course.update({ where: { id: course.courseId }, data: { status: "published", publishedAt: new Date(), kind } });
  const make = async (title: string) => {
    const { examId } = await createExam(owner.userId, course.courseId, { title, durationMin: 10, mockMode: true });
    const { id: sectionId } = await createSection(owner.userId, examId, { title: "Nghe", durationMin: 10, languageSkill: "listening" });
    await createExamQuestion(owner.userId, examId, { ...MCQ, sectionId });
    await publishExam(owner.userId, examId);
    return examId;
  };
  const free = await make("Học thử");
  const locked = await make("Khoá");
  await updateExam(owner.userId, free, { freePreview: true });
  const stranger = await registerUser({ email: `la-s-${slug}@e.com`, password: "password1234", displayName: "S" }, BASE);
  return { ownerId: owner.userId, courseId: course.courseId, free, locked, strangerId: stranger.userId };
}

describe("học thử miễn phí (L6.1)", () => {
  it("người chưa ghi danh LUYỆN được đề học thử nhưng không luyện được đề khoá", async () => {
    const s = await setup("practice");
    expect((await getPracticeOverview(s.strangerId, s.free)).sections).toHaveLength(1);
    await expect(startPracticeSession(s.strangerId, s.free, { all: true })).resolves.toBeTruthy();
    await expect(getPracticeOverview(s.strangerId, s.locked)).rejects.toMatchObject({ code: "not_enrolled" });
    await expect(startPracticeSession(s.strangerId, s.locked, { all: true })).rejects.toMatchObject({ code: "not_enrolled" });
  });

  it("người chưa ghi danh vào PHÒNG THI MÔ PHỎNG được đề học thử, không vào được đề khoá", async () => {
    const s = await setup("mock");
    await expect(startExamAttempt(s.strangerId, s.free)).resolves.toMatchObject({ attemptId: expect.any(String) });
    await expect(startExamAttempt(s.strangerId, s.locked)).rejects.toBeInstanceOf(ExamError);
    await expect(startExamAttempt(s.strangerId, s.locked)).rejects.toMatchObject({ code: "not_enrolled" });
  });

  it("cờ freePreview KHÔNG có tác dụng ở khoá thường", async () => {
    const s = await setup("standard", "standard");
    await expect(getPracticeOverview(s.strangerId, s.free)).rejects.toMatchObject({ code: "not_enrolled" });
    await expect(startExamAttempt(s.strangerId, s.free)).rejects.toMatchObject({ code: "not_enrolled" });
  });

  it("khoá luyện đề còn NHÁP thì đề học thử cũng không mở cho người ngoài", async () => {
    const s = await setup("draftcourse");
    await prisma.course.update({ where: { id: s.courseId }, data: { status: "draft" } });
    await expect(getPracticeOverview(s.strangerId, s.free)).rejects.toMatchObject({ code: "not_enrolled" });
    await expect(startExamAttempt(s.strangerId, s.free)).rejects.toMatchObject({ code: "not_enrolled" });
  });

  it("đề học thử mà chưa xuất bản hoặc tắt luyện đề thì vẫn không dùng được", async () => {
    const s = await setup("off");
    await updateExam(s.ownerId, s.free, { allowPractice: false });
    await expect(getPracticeOverview(s.strangerId, s.free)).rejects.toMatchObject({ code: "practice_disabled" });
  });
});

describe("updateExam — phân loại trong khoá luyện đề (L6.6)", () => {
  it("lưu họ phân loại, nguồn, năm, số thứ tự, độ khó, tag và đọc lại đúng", async () => {
    const s = await setup("meta");
    await updateExam(s.ownerId, s.locked, {
      paperType: "official", sourceLabel: "HSK 2023-05", yearLabel: "2023", seq: 7, difficulty: 3, tags: ["Part 1", "thực tế"],
    });
    const e = await prisma.exam.findUniqueOrThrow({ where: { id: s.locked } });
    expect(e).toMatchObject({ paperType: "official", sourceLabel: "HSK 2023-05", yearLabel: "2023", seq: 7, difficulty: 3, tags: ["Part 1", "thực tế"] });
  });

  it("từ chối độ khó ngoài 1–5, số thứ tự âm, tag quá dài, quá 20 tag", async () => {
    const s = await setup("bad");
    for (const bad of [{ difficulty: 0 }, { difficulty: 6 }, { seq: -1 }, { tags: ["x".repeat(41)] }, { tags: Array.from({ length: 21 }, (_, i) => `t${i}`) }, { paperType: "x" }]) {
      await expect(updateExam(s.ownerId, s.locked, bad), JSON.stringify(bad)).rejects.toMatchObject({ code: "validation_failed" });
    }
  });

  it("gán đề vào bộ của CHÍNH khoá; bộ của khoá khác bị từ chối; null để bỏ khỏi bộ", async () => {
    const s = await setup("coll");
    const other = await setup("coll2");
    const mine = await prisma.examCollection.create({ data: { courseId: s.courseId, title: "Part 1" } });
    const foreign = await prisma.examCollection.create({ data: { courseId: other.courseId, title: "Khác" } });
    await updateExam(s.ownerId, s.locked, { collectionId: mine.id });
    expect((await prisma.exam.findUniqueOrThrow({ where: { id: s.locked } })).collectionId).toBe(mine.id);
    await expect(updateExam(s.ownerId, s.locked, { collectionId: foreign.id })).rejects.toMatchObject({ code: "validation_failed" });
    await updateExam(s.ownerId, s.locked, { collectionId: null });
    expect((await prisma.exam.findUniqueOrThrow({ where: { id: s.locked } })).collectionId).toBeNull();
  });

  it("đã xuất bản và đã có lượt thi: vẫn sửa được phân loại và cờ học thử (chỉ là siêu dữ liệu)", async () => {
    const s = await setup("after");
    await startExamAttempt(s.strangerId, s.free); // học thử ⇒ có lượt thi
    await updateExam(s.ownerId, s.free, { sourceLabel: "Sửa sau", difficulty: 2, freePreview: false });
    const e = await prisma.exam.findUniqueOrThrow({ where: { id: s.free } });
    expect(e).toMatchObject({ sourceLabel: "Sửa sau", difficulty: 2, freePreview: false });
  });
});
