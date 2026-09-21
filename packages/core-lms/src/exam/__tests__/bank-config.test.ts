import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import { commitMcqRowsToBank } from "../../imports/commitToBank";
import type { ParsedMcqRow } from "../../imports/mcqTemplate";
import {
  bulkUpdateBankQuestionStatus,
  copyBankQuestionToExam,
  createBank,
  createExam,
  createBankQuestion,
  listMatchingQuestionIds,
  publishBankQuestion,
  searchQuestions,
  updateBankQuestion,
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
    { email: `bc-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `C ${slug}`,
    description: "x",
    slug: `bc-course-${slug}`,
  });
  const bank = await createBank(owner.userId, { name: `Bank ${slug}`, courseId: course.courseId });
  return { ownerId: owner.userId, bankId: bank.id };
}

/** Câu hỏng như dữ liệu cũ: ghi thẳng, bỏ qua validate của service. */
async function legacyQuestion(bankId: string, type: string, config: object, status = "draft") {
  return prisma.bankQuestion.create({
    data: { bankId, type: type as never, prompt: "Legacy", config: config as never, status: status as never },
    select: { id: true },
  });
}

describe("ngân hàng — validate config theo loại câu", () => {
  it("mcq không có đáp án đúng bị từ chối", async () => {
    const { ownerId, bankId } = await setup("mcq0");
    await expect(
      createBankQuestion(ownerId, bankId, {
        type: "mcq",
        prompt: "Q",
        config: { options: [{ id: "a", label: "A", isCorrect: false }, { id: "b", label: "B", isCorrect: false }] },
      }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("mcq dưới 2 lựa chọn bị từ chối", async () => {
    const { ownerId, bankId } = await setup("mcq1");
    await expect(
      createBankQuestion(ownerId, bankId, {
        type: "mcq",
        prompt: "Q",
        config: { options: [{ id: "a", label: "A", isCorrect: true }] },
      }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("gap_fill config rỗng và short_answer không có đáp án bị từ chối", async () => {
    const { ownerId, bankId } = await setup("gap");
    await expect(
      createBankQuestion(ownerId, bankId, { type: "gap_fill", prompt: "Q", config: {} }),
    ).rejects.toMatchObject({ code: "validation_failed" });
    await expect(
      createBankQuestion(ownerId, bankId, {
        type: "short_answer",
        prompt: "Q",
        config: { acceptedAnswers: [], matchMode: "exact" },
      }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("essay config rỗng hợp lệ; gap_fill đủ blank hợp lệ", async () => {
    const { ownerId, bankId } = await setup("ok");
    await createBankQuestion(ownerId, bankId, { type: "essay", prompt: "Q", config: {} });
    await createBankQuestion(ownerId, bankId, {
      type: "gap_fill",
      prompt: "Q",
      config: { blanks: [{ id: "b1", acceptedAnswers: ["x"], matchMode: "exact" }] },
    });
  });

  it("giữ nguyên các khoá ngoài schema (topic) khi lưu", async () => {
    const { ownerId, bankId } = await setup("topic");
    const { id } = await createBankQuestion(ownerId, bankId, {
      type: "mcq",
      prompt: "Q",
      config: { ...mcq(), topic: "Địa lý" },
    });
    const row = await prisma.bankQuestion.findUniqueOrThrow({ where: { id } });
    expect((row.config as { topic?: string }).topic).toBe("Địa lý");
  });

  it('T/F/NG: "not_given" cũ được chuẩn hoá thành "notgiven" khi lưu', async () => {
    const { ownerId, bankId } = await setup("tfng");
    const { id } = await createBankQuestion(ownerId, bankId, {
      type: "true_false_notgiven",
      prompt: "Q",
      config: { correct: "not_given" },
    });
    const row = await prisma.bankQuestion.findUniqueOrThrow({ where: { id } });
    expect((row.config as { correct: string }).correct).toBe("notgiven");
  });

  it("update config sai bị từ chối; update chỉ prompt trên câu cũ hỏng vẫn được", async () => {
    const { ownerId, bankId } = await setup("upd");
    const legacy = await legacyQuestion(bankId, "gap_fill", {});
    await expect(
      updateBankQuestion(ownerId, legacy.id, { config: { blanks: [] } }),
    ).rejects.toMatchObject({ code: "validation_failed" });
    await updateBankQuestion(ownerId, legacy.id, { prompt: "Sửa chữ" });
  });

  it("publish câu có config hỏng bị chặn; câu hợp lệ publish được", async () => {
    const { ownerId, bankId } = await setup("pub");
    const bad = await legacyQuestion(bankId, "gap_fill", {});
    await expect(publishBankQuestion(ownerId, bad.id)).rejects.toMatchObject({
      code: "bank_question_not_publishable",
    });
    expect((await prisma.bankQuestion.findUniqueOrThrow({ where: { id: bad.id } })).status).toBe("draft");
    const good = await createBankQuestion(ownerId, bankId, { type: "mcq", prompt: "Q", config: mcq() });
    await publishBankQuestion(ownerId, good.id);
  });

  it("bulk publish bỏ qua câu hỏng và nói rõ lý do", async () => {
    const { ownerId, bankId } = await setup("bulk");
    const bad = await legacyQuestion(bankId, "short_answer", { acceptedAnswers: [] });
    const good = await createBankQuestion(ownerId, bankId, { type: "mcq", prompt: "Q", config: mcq() });
    const r = await bulkUpdateBankQuestionStatus(ownerId, [bad.id, good.id], "publish");
    expect(r.ok).toEqual([good.id]);
    expect(r.skipped).toEqual([{ id: bad.id, reason: expect.stringContaining("đáp án") }]);
  });
});

describe("ngân hàng — tìm kiếm kết hợp từ khoá và chủ đề", () => {
  async function seed(slug: string) {
    const s = await setup(slug);
    const mk = (prompt: string, topic: string) =>
      createBankQuestion(s.ownerId, s.bankId, { type: "mcq", prompt, config: { ...mcq(), topic } });
    await mk("Hàm số bậc nhất", "Toán");
    await mk("Hàm số bậc hai", "Lý");
    await mk("Phương trình", "Toán");
    return s;
  }

  it("searchQuestions: q AND topics", async () => {
    const s = await seed("srch");
    const r = await searchQuestions(s.ownerId, { bankIds: [s.bankId], q: "hàm số", topics: ["Toán"] });
    expect(r.items.map((i) => i.prompt)).toEqual(["Hàm số bậc nhất"]);
    expect(r.totalMatching).toBe(1);
  });

  it("listMatchingQuestionIds dùng cùng tập với searchQuestions", async () => {
    const s = await seed("ids");
    const ids = await listMatchingQuestionIds(s.ownerId, { bankIds: [s.bankId], q: "hàm số", topics: ["Toán"] });
    expect(ids).toHaveLength(1);
  });
});

describe("import Excel — giữ lời giải", () => {
  it("cột Explanation được lưu vào config.explanation", async () => {
    const { ownerId, bankId } = await setup("imp");
    const row: ParsedMcqRow = {
      rowNumber: 2,
      status: "ok",
      errors: [],
      warnings: [],
      parsed: {
        type: "mcq",
        prompt: "Thủ đô của Việt Nam?",
        options: [
          { letter: "A", label: "Hà Nội", isCorrect: true },
          { letter: "B", label: "Huế", isCorrect: false },
        ],
        points: 1,
        difficulty: 2,
        cognitiveLevel: "apply",
        explanation: "Hà Nội là thủ đô từ 1010.",
        topic: null,
        code: null,
        learningOutcome: null,
        authorName: null,
        reviewStatus: null,
        editNote: null,
      },
    };
    const r = await commitMcqRowsToBank(ownerId, bankId, [row]);
    expect(r.created).toBe(1);
    const q = await prisma.bankQuestion.findFirstOrThrow({ where: { bankId } });
    expect((q.config as { explanation?: string }).explanation).toBe("Hà Nội là thủ đô từ 1010.");
  });
});

describe("copy vào đề — câu published cũ có config hỏng", () => {
  it("bị chặn thay vì đem sang đề rồi làm chấm bài ném lỗi", async () => {
    const { ownerId, bankId } = await setup("copy");
    const bank = await prisma.questionBank.findUniqueOrThrow({
      where: { id: bankId },
      select: { courseId: true },
    });
    const now = Date.now();
    const { examId } = await createExam(ownerId, bank.courseId!, {
      title: "E",
      durationMin: 30,
      openAt: new Date(now - 60_000),
      closeAt: new Date(now + 86_400_000),
    });
    const bad = await legacyQuestion(bankId, "gap_fill", {}, "published");
    await expect(
      copyBankQuestionToExam(ownerId, bad.id, examId, {}),
    ).rejects.toMatchObject({ code: "bank_question_not_publishable" });
    expect(await prisma.examQuestion.count({ where: { examId } })).toBe(0);
  });
});
