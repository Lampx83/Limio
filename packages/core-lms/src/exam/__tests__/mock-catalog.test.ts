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
} from "../";

/**
 * LANG G5c.2 / G5c.6 — mục "Luyện thi" trên trang khoá: chỉ đề thi thử đã xuất bản của
 * CHÍNH khoá này, chỉ cho học viên đã ghi danh, kèm trạng thái của học viên.
 */

const BASE = "http://localhost:3000";
const MCQ = {
  type: "mcq" as const,
  prompt: "Q",
  config: { options: [{ id: "a", label: "A", isCorrect: true }, { id: "b", label: "B", isCorrect: false }] },
};

async function setupCourse(slug: string) {
  const owner = await registerUser({ email: `mc-o-${slug}@e.com`, password: "password1234", displayName: "O" }, BASE);
  const course = await createCourse(owner.userId, { title: `C ${slug}`, description: "x", slug: `mc-course-${slug}` });
  await prisma.course.update({ where: { id: course.courseId }, data: { status: "published", publishedAt: new Date() } });
  const learner = await registerUser({ email: `mc-l-${slug}@e.com`, password: "password1234", displayName: "L" }, BASE);
  return { ownerId: owner.userId, courseId: course.courseId, learnerId: learner.userId };
}

async function makeExam(
  c: { ownerId: string; courseId: string },
  title: string,
  o: { mock?: boolean; publish?: boolean; sections?: { title: string; min: number; skill: "listening" | "reading" }[] } = {},
) {
  const { mock = true, publish = true, sections = [{ title: "Nghe", min: 10, skill: "listening" }] } = o;
  const { examId } = await createExam(c.ownerId, c.courseId, { title, durationMin: 10, mockMode: mock });
  for (const s of sections) {
    const { id } = await createSection(c.ownerId, examId, { title: s.title, durationMin: s.min, languageSkill: s.skill });
    await createExamQuestion(c.ownerId, examId, { ...MCQ, sectionId: id });
  }
  if (publish) await publishExam(c.ownerId, examId);
  return examId;
}

describe("listMockExamsForLearner", () => {
  it("chỉ đề thi thử ĐÃ XUẤT BẢN của khoá này; bỏ đề nháp, đề thường, đề của khoá khác", async () => {
    const c = await setupCourse("filter");
    const other = await setupCourse("filter-other");
    const ok = await makeExam(c, "Thi thử A");
    await makeExam(c, "Nháp", { publish: false });
    await makeExam(c, "Đề thường", { mock: false });
    await makeExam(other, "Khoá khác");
    await enrollInCourse(c.learnerId, c.courseId);
    const list = await listMockExamsForLearner(c.learnerId, c.courseId);
    expect(list.map((e) => e.examId)).toEqual([ok]);
  });

  it("kèm cấu trúc các phần: tên, kỹ năng, số phút; tổng số phút", async () => {
    const c = await setupCourse("struct");
    await makeExam(c, "HSK", {
      sections: [
        { title: "Nghe", min: 30, skill: "listening" },
        { title: "Đọc", min: 45, skill: "reading" },
      ],
    });
    await enrollInCourse(c.learnerId, c.courseId);
    const [e] = await listMockExamsForLearner(c.learnerId, c.courseId);
    expect(e!.sections).toEqual([
      { title: "Nghe", languageSkill: "listening", durationMin: 30 },
      { title: "Đọc", languageSkill: "reading", durationMin: 45 },
    ]);
    expect(e!.totalMinutes).toBe(75);
  });

  it("chưa ghi danh → từ chối not_enrolled (không lộ danh sách đề)", async () => {
    const c = await setupCourse("noenroll");
    await makeExam(c, "Thi thử");
    await expect(listMockExamsForLearner(c.learnerId, c.courseId)).rejects.toMatchObject({ code: "not_enrolled" });
  });

  it("trạng thái của học viên: chưa làm → đang làm dở → đã nộp", async () => {
    const c = await setupCourse("state");
    const examId = await makeExam(c, "Thi thử");
    await enrollInCourse(c.learnerId, c.courseId);
    expect((await listMockExamsForLearner(c.learnerId, c.courseId))[0]!.attempt).toBeNull();

    const { attemptId } = await startExamAttempt(c.learnerId, examId);
    const mid = (await listMockExamsForLearner(c.learnerId, c.courseId))[0]!.attempt;
    expect(mid).toMatchObject({ attemptId, status: "in_progress" });

    await endCurrentSection({ kind: "user", userId: c.learnerId }, attemptId);
    const done = (await listMockExamsForLearner(c.learnerId, c.courseId))[0]!.attempt;
    expect(done).toMatchObject({ attemptId });
    expect(done!.status).not.toBe("in_progress");
  });

  it("trạng thái chỉ của CHÍNH học viên đó (không thấy lượt của người khác)", async () => {
    const c = await setupCourse("own");
    const examId = await makeExam(c, "Thi thử");
    await enrollInCourse(c.learnerId, c.courseId);
    const other = await registerUser({ email: "mc-l2-own@e.com", password: "password1234", displayName: "L2" }, BASE);
    await enrollInCourse(other.userId, c.courseId);
    await startExamAttempt(other.userId, examId);
    expect((await listMockExamsForLearner(c.learnerId, c.courseId))[0]!.attempt).toBeNull();
  });

  it("khoá không có đề thi thử → mảng rỗng", async () => {
    const c = await setupCourse("empty");
    await enrollInCourse(c.learnerId, c.courseId);
    expect(await listMockExamsForLearner(c.learnerId, c.courseId)).toEqual([]);
  });
});
