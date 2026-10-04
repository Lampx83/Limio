import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { createCourse } from "../../courses/courses";
import { registerUser } from "../../auth/register";
import { MOCK_EXAM_TEMPLATES, createMockExamFromTemplate } from "../";

/**
 * LANG G5c.1 — khung đề: CHỈ tạo cấu trúc rỗng (các phần + kỹ năng). Không kèm câu hỏi,
 * giờ hay bảng quy đổi — số liệu chính thức do giảng viên đối chiếu nguồn rồi điền.
 */

const BASE = "http://localhost:3000";

async function setup(slug: string) {
  const owner = await registerUser({ email: `mt-o-${slug}@e.com`, password: "password1234", displayName: "O" }, BASE);
  const course = await createCourse(owner.userId, { title: `C ${slug}`, description: "x", slug: `mt-course-${slug}` });
  const other = await registerUser({ email: `mt-x-${slug}@e.com`, password: "password1234", displayName: "X" }, BASE);
  return { ownerId: owner.userId, courseId: course.courseId, otherId: other.userId };
}

describe("createMockExamFromTemplate", () => {
  it("khung HSK: đề thi thử nháp với 3 phần Nghe · Đọc · Viết đúng kỹ năng, theo thứ tự; không có giờ", async () => {
    const s = await setup("hsk");
    const { examId } = await createMockExamFromTemplate(s.ownerId, s.courseId, { title: "HSK 3 thử", template: "hsk" });
    const exam = await prisma.exam.findUniqueOrThrow({ where: { id: examId }, include: { sections: { orderBy: { orderIndex: "asc" } } } });
    expect(exam).toMatchObject({ mockMode: true, status: "draft", title: "HSK 3 thử" });
    expect(exam.sections.map((x) => [x.title, x.languageSkill, x.durationMin])).toEqual([
      ["Nghe", "listening", null],
      ["Đọc", "reading", null],
      ["Viết", "writing", null],
    ]);
  });

  it("khung IELTS và TOEIC: IELTS 3 phần (không có Nói — nằm ngoài thi thử), TOEIC 2 phần", async () => {
    const s = await setup("ielts");
    const ielts = await createMockExamFromTemplate(s.ownerId, s.courseId, { title: "IELTS", template: "ielts" });
    const toeic = await createMockExamFromTemplate(s.ownerId, s.courseId, { title: "TOEIC", template: "toeic" });
    const skills = async (id: string) =>
      (await prisma.examSection.findMany({ where: { examId: id }, orderBy: { orderIndex: "asc" } })).map((x) => x.languageSkill);
    expect(await skills(ielts.examId)).toEqual(["listening", "reading", "writing"]);
    expect(await skills(toeic.examId)).toEqual(["listening", "reading"]);
  });

  it("khung Tuỳ chỉnh: đề thi thử rỗng, không có phần nào", async () => {
    const s = await setup("custom");
    const { examId } = await createMockExamFromTemplate(s.ownerId, s.courseId, { title: "Tuỳ chỉnh", template: "custom" });
    expect(await prisma.examSection.count({ where: { examId } })).toBe(0);
    expect((await prisma.exam.findUniqueOrThrow({ where: { id: examId } })).mockMode).toBe(true);
  });

  it("khung KHÔNG kèm câu hỏi, bài đọc hay bảng quy đổi (không đưa nội dung có bản quyền vào)", async () => {
    const s = await setup("empty");
    const { examId } = await createMockExamFromTemplate(s.ownerId, s.courseId, { title: "HSK", template: "hsk" });
    expect(await prisma.examQuestion.count({ where: { examId } })).toBe(0);
    expect(await prisma.examPassage.count({ where: { examId } })).toBe(0);
  });

  it("đề dựng từ khung chưa xuất bản được cho tới khi điền giờ và câu hỏi (kiểm tra của G5a vẫn áp)", async () => {
    const s = await setup("publish");
    const { examId } = await createMockExamFromTemplate(s.ownerId, s.courseId, { title: "HSK", template: "hsk" });
    const { publishExam } = await import("../");
    await expect(publishExam(s.ownerId, examId)).rejects.toMatchObject({ code: "exam_not_publishable" });
  });

  it("khung lạ → validation_failed; tiêu đề rỗng → validation_failed", async () => {
    const s = await setup("bad");
    await expect(createMockExamFromTemplate(s.ownerId, s.courseId, { title: "X", template: "gre" })).rejects.toMatchObject({ code: "validation_failed" });
    await expect(createMockExamFromTemplate(s.ownerId, s.courseId, { title: "  ", template: "hsk" })).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("người không có quyền sửa khoá không tạo được", async () => {
    const s = await setup("authz");
    await expect(createMockExamFromTemplate(s.otherId, s.courseId, { title: "X", template: "hsk" })).rejects.toBeTruthy();
    expect(await prisma.exam.count({ where: { courseId: s.courseId } })).toBe(0);
  });

  it("danh sách khung có đủ 4 mục và mỗi mục có tên hiển thị", () => {
    expect(MOCK_EXAM_TEMPLATES.map((t) => t.id)).toEqual(["hsk", "ielts", "toeic", "custom"]);
    for (const t of MOCK_EXAM_TEMPLATES) expect(t.label.length).toBeGreaterThan(0);
  });
});
