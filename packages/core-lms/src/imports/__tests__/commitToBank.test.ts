import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import { createBank } from "../../exam/bank";
import { aiQuestionsToParseResult } from "../aiQuestionRows";
import { commitMcqRowsToBank } from "../commitToBank";

const BASE = "http://localhost:3000";

async function setup(slug: string) {
  const owner = await registerUser(
    { email: `commit-bank-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `C ${slug}`,
    description: "x",
    slug: `commit-bank-course-${slug}`,
  });
  const bank = await createBank(owner.userId, { name: `Bank ${slug}`, courseId: course.courseId });
  return { ownerId: owner.userId, bankId: bank.id };
}

describe("commitMcqRowsToBank — ordering/matching (Đợt sau đợt 1: mở rộng Nhập bằng AI)", () => {
  it("ordering: tạo BankQuestion type=ordering, config.items đúng thứ tự AI trả về", async () => {
    const { ownerId, bankId } = await setup("ordering");
    const { rows } = aiQuestionsToParseResult([
      {
        type: "ordering",
        prompt: "Sắp xếp thành câu đúng",
        items: [{ label: "邮局" }, { label: "我" }, { label: "去" }],
        explanation: null,
        topic: "Bài 21",
      },
    ]);
    const r = await commitMcqRowsToBank(ownerId, bankId, rows);
    expect(r).toEqual({ created: 1, errors: [] });

    const q = await prisma.bankQuestion.findFirstOrThrow({ where: { bankId } });
    expect(q.type).toBe("ordering");
    const cfg = q.config as { items: Array<{ label: string }> };
    expect(cfg.items.map((i) => i.label)).toEqual(["邮局", "我", "去"]);
  });

  it("matching: tạo BankQuestion type=matching, config.pairs giữ đúng left/right", async () => {
    const { ownerId, bankId } = await setup("matching");
    const { rows } = aiQuestionsToParseResult([
      {
        type: "matching",
        prompt: "Ghép từ Hán với nghĩa tiếng Việt",
        pairs: [
          { left: "寄", right: "gửi" },
          { left: "包裹", right: "bưu kiện" },
        ],
        explanation: null,
        topic: null,
      },
    ]);
    const r = await commitMcqRowsToBank(ownerId, bankId, rows);
    expect(r).toEqual({ created: 1, errors: [] });

    const q = await prisma.bankQuestion.findFirstOrThrow({ where: { bankId } });
    expect(q.type).toBe("matching");
    const cfg = q.config as { pairs: Array<{ left: string; right: string }> };
    expect(cfg.pairs).toEqual([
      expect.objectContaining({ left: "寄", right: "gửi" }),
      expect.objectContaining({ left: "包裹", right: "bưu kiện" }),
    ]);
  });

  it("câu ordering/matching lỗi (đã bị chặn ở bước parse) không được commit", async () => {
    const { ownerId, bankId } = await setup("invalid");
    const { rows } = aiQuestionsToParseResult([
      { type: "ordering", prompt: "Q", items: [{ label: "một mảnh" }], explanation: null, topic: null },
    ]);
    expect(rows[0]!.status).toBe("error");
    const r = await commitMcqRowsToBank(ownerId, bankId, rows);
    expect(r).toEqual({ created: 0, errors: [] }); // status=error bị lọc trước khi commit, không tính là lỗi commit
    expect(await prisma.bankQuestion.count({ where: { bankId } })).toBe(0);
  });

  it("fill_in: tạo BankQuestion type=short_answer (config đã có sẵn từ trước đợt 1)", async () => {
    const { ownerId, bankId } = await setup("fillin");
    const { rows } = aiQuestionsToParseResult([
      {
        type: "fill_in",
        prompt: "我明天＿＿上海。",
        acceptedAnswers: ["去", "qù"],
        explanation: null,
        topic: null,
      },
    ]);
    const r = await commitMcqRowsToBank(ownerId, bankId, rows);
    expect(r).toEqual({ created: 1, errors: [] });

    const q = await prisma.bankQuestion.findFirstOrThrow({ where: { bankId } });
    expect(q.type).toBe("short_answer");
    const cfg = q.config as { acceptedAnswers: string[]; matchMode: string };
    expect(cfg.acceptedAnswers).toEqual(["去", "qù"]);
    expect(cfg.matchMode).toBe("case_insensitive");
  });

  it("trộn mcq + ordering + matching + fill_in trong một lượt: cả 4 đều tạo được", async () => {
    const { ownerId, bankId } = await setup("mixed");
    const { rows } = aiQuestionsToParseResult([
      {
        type: "mcq",
        prompt: "Câu mcq",
        options: [{ label: "A", isCorrect: true }, { label: "B", isCorrect: false }],
        explanation: null,
        topic: null,
      },
      { type: "ordering", prompt: "Câu ordering", items: [{ label: "a" }, { label: "b" }], explanation: null, topic: null },
      {
        type: "matching",
        prompt: "Câu matching",
        pairs: [{ left: "a", right: "x" }, { left: "b", right: "y" }],
        explanation: null,
        topic: null,
      },
      { type: "fill_in", prompt: "Câu fill_in ＿＿", acceptedAnswers: ["x"], explanation: null, topic: null },
    ]);
    const r = await commitMcqRowsToBank(ownerId, bankId, rows);
    expect(r).toEqual({ created: 4, errors: [] });
    const types = (await prisma.bankQuestion.findMany({ where: { bankId }, select: { type: true } }))
      .map((q) => q.type)
      .sort();
    expect(types).toEqual(["mcq", "matching", "ordering", "short_answer"].sort());
  });
});

describe("commitMcqRowsToBank — true_false: đáp án đúng theo NỘI DUNG nhãn, không theo vị trí", () => {
  // Sự cố tiềm ẩn: commitToBank.ts từng suy "true"/"false" từ VỊ TRÍ option
  // (option đầu = OptionA → luôn map thành "true"), không đọc nội dung nhãn.
  // AI không bị ép trả "Đúng" luôn trước "Sai" — nếu trả ngược thứ tự, câu bị
  // chấm SAI HOÀN TOÀN dù đáp án đúng.
  it("AI trả 'Sai' trước 'Đúng' (thứ tự đảo ngược): config.correct vẫn phải là 'false', không phải 'true'", async () => {
    const { ownerId, bankId } = await setup("tf-reversed");
    const { rows } = aiQuestionsToParseResult([
      {
        type: "true_false",
        prompt: "Trái đất phẳng.",
        options: [
          { label: "Sai", isCorrect: true },
          { label: "Đúng", isCorrect: false },
        ],
        explanation: null,
        topic: null,
      },
    ]);
    await commitMcqRowsToBank(ownerId, bankId, rows);
    const q = await prisma.bankQuestion.findFirstOrThrow({ where: { bankId } });
    expect((q.config as { correct: string }).correct).toBe("false");
  });

  it("thứ tự thuận (Đúng trước Sai): config.correct đúng là 'true'", async () => {
    const { ownerId, bankId } = await setup("tf-normal");
    const { rows } = aiQuestionsToParseResult([
      {
        type: "true_false",
        prompt: "Trái đất tròn.",
        options: [
          { label: "Đúng", isCorrect: true },
          { label: "Sai", isCorrect: false },
        ],
        explanation: null,
        topic: null,
      },
    ]);
    await commitMcqRowsToBank(ownerId, bankId, rows);
    const q = await prisma.bankQuestion.findFirstOrThrow({ where: { bankId } });
    expect((q.config as { correct: string }).correct).toBe("true");
  });

  it("nhãn tiếng Anh 'False' đứng trước 'True': vẫn nhận đúng", async () => {
    const { ownerId, bankId } = await setup("tf-en");
    const { rows } = aiQuestionsToParseResult([
      {
        type: "true_false",
        prompt: "Q",
        options: [
          { label: "False", isCorrect: true },
          { label: "True", isCorrect: false },
        ],
        explanation: null,
        topic: null,
      },
    ]);
    await commitMcqRowsToBank(ownerId, bankId, rows);
    const q = await prisma.bankQuestion.findFirstOrThrow({ where: { bankId } });
    expect((q.config as { correct: string }).correct).toBe("false");
  });
});
