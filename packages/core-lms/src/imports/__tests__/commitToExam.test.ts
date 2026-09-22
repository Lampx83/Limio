import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import { createExam } from "../../exam/exams";
import { commitExamQuestionRows } from "../commitToExam";
import type { ParsedQuestionRow } from "../../exam/import";

const BASE = "http://localhost:3000";

async function setup(slug: string) {
  const owner = await registerUser(
    { email: `commit-exam-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `C ${slug}`,
    description: "x",
    slug: `commit-exam-course-${slug}`,
  });
  const now = Date.now();
  const { examId } = await createExam(owner.userId, course.courseId, {
    title: "Exam",
    durationMin: 60,
    openAt: new Date(now + 60_000),
    closeAt: new Date(now + 7 * 24 * 60 * 60_000),
  });
  return { ownerId: owner.userId, examId };
}

function okRow(rowNumber: number, over: Partial<NonNullable<ParsedQuestionRow["parsed"]>> = {}): ParsedQuestionRow {
  return {
    rowNumber,
    status: "ok",
    errors: [],
    warnings: [],
    parsed: {
      type: "mcq",
      prompt: `Câu ${rowNumber}`,
      passageId: null,
      passageTitleRaw: "",
      points: 1,
      difficulty: 2,
      config: {
        options: [
          { id: "a", label: "A", isCorrect: true },
          { id: "b", label: "B", isCorrect: false },
        ],
      },
      skillIds: [],
      unresolvedSkillCodes: [],
      notes: null,
      ...over,
    },
  };
}

describe("commitExamQuestionRows", () => {
  it("tạo ExamQuestion cho các row status=ok, giữ đúng config/points/prompt", async () => {
    const { ownerId, examId } = await setup("basic");
    const r = await commitExamQuestionRows(ownerId, examId, [okRow(1)]);
    expect(r.imported).toBe(1);
    expect(r.errors).toEqual([]);

    const q = await prisma.examQuestion.findFirstOrThrow({ where: { examId } });
    expect(q.type).toBe("mcq");
    expect(q.prompt).toBe("Câu 1");
    expect(q.points).toBe(1);
  });

  it("bỏ qua row status=error, không tạo gì", async () => {
    const { ownerId, examId } = await setup("skip-error");
    const errorRow: ParsedQuestionRow = { rowNumber: 1, status: "error", errors: ["x"], warnings: [] };
    const r = await commitExamQuestionRows(ownerId, examId, [errorRow]);
    expect(r.imported).toBe(0);
    expect(await prisma.examQuestion.count({ where: { examId } })).toBe(0);
  });

  it("orderInExam nối tiếp câu đã có sẵn, không ghi đè", async () => {
    const { ownerId, examId } = await setup("order");
    await commitExamQuestionRows(ownerId, examId, [okRow(1)]);
    await commitExamQuestionRows(ownerId, examId, [okRow(1)]);
    const qs = await prisma.examQuestion.findMany({
      where: { examId },
      orderBy: { orderInExam: "asc" },
    });
    expect(qs.map((q) => q.orderInExam)).toEqual([0, 1]);
  });

  it("gán skillIds khi row có sẵn", async () => {
    const { ownerId, examId } = await setup("skills");
    const skill = await prisma.skill.create({ data: { code: "commit-exam-skills.1", name: "S" } });
    await commitExamQuestionRows(ownerId, examId, [okRow(1, { skillIds: [skill.id] })]);
    const q = await prisma.examQuestion.findFirstOrThrow({
      where: { examId },
      include: { skillTags: true },
    });
    expect(q.skillTags.map((t) => t.skillId)).toEqual([skill.id]);
  });

  it("nhiều row, một row lỗi tạo (config hỏng bên dưới validate) không chặn các row khác", async () => {
    const { ownerId, examId } = await setup("partial-fail");
    const badRow = okRow(2, { type: "mcq", config: { options: [] } }); // options rỗng -> DB/prisma tạo vẫn được vì config là Json tự do, không throw ở tầng này — dùng row hỏng thật hơn:
    void badRow;
    // Cách chắc chắn gây lỗi thật ở tầng ghi: examId không tồn tại cho 1 phần tử riêng không khả thi (cùng examId) —
    // nên kiểm bằng passageId trỏ tới đoạn văn không thuộc đề này.
    const rowWithBadPassage = okRow(2, { passageId: "00000000-0000-0000-0000-000000000000" });
    const r = await commitExamQuestionRows(ownerId, examId, [okRow(1), rowWithBadPassage]);
    expect(r.imported).toBe(1);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]!.rowNumber).toBe(2);
    expect(await prisma.examQuestion.count({ where: { examId } })).toBe(1);
  });
});
