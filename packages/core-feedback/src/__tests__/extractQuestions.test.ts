import { describe, expect, it } from "vitest";
import type OpenAI from "openai";
import { prisma } from "@feedbackme/db";
import { AiGenerationError, extractQuestionsFromText } from "../aiTutor/generators";
import { AiTutorError } from "../aiTutor/errors";
import { chargeTokens, getTokenBudget } from "../aiTutor/tokenWallet";

/**
 * "Nhập bằng AI" — GV dán văn bản câu hỏi thô (từ Word, ghi tay...), AI tách
 * thành mảng câu hỏi có cấu trúc. AI CHỈ đọc hiểu — không tự quyết câu nào hợp
 * lệ, việc đó là của aiQuestionsToParseResult (packages/core-lms/src/imports).
 */

function fakeOpenAI(
  questions: unknown[],
  skipped: unknown[] = [],
  inputTokens = 500,
  outputTokens = 300,
): OpenAI {
  return {
    chat: {
      completions: {
        create: async () => ({
          choices: [{ message: { content: JSON.stringify({ questions, skipped }) } }],
          usage: { prompt_tokens: inputTokens, completion_tokens: outputTokens },
        }),
      },
    },
  } as unknown as OpenAI;
}

/** OpenAI giả luôn throw nếu bị gọi — dùng để xác nhận cap chặn TRƯỚC khi tốn tiền. */
function neverCallOpenAI(): OpenAI {
  return {
    chat: {
      completions: {
        create: async () => {
          throw new Error("KHÔNG được gọi OpenAI khi đã hết hạn mức");
        },
      },
    },
  } as unknown as OpenAI;
}

async function makeUser(slug: string) {
  const u = await prisma.user.create({
    data: { email: `extract-${slug}-${Date.now()}@e.com`, passwordHash: "x", displayName: slug },
  });
  return u.id;
}

const sampleQuestion = {
  type: "mcq",
  prompt: "Thủ đô của Việt Nam là gì?",
  options: [
    { label: "Hà Nội", isCorrect: true },
    { label: "Huế", isCorrect: false },
  ],
  explanation: "Hà Nội là thủ đô.",
  topic: "Địa lý",
};

describe("extractQuestionsFromText — validate (không chạm OpenAI/DB)", () => {
  it("văn bản rỗng → validation_failed, không gọi OpenAI", async () => {
    await expect(
      extractQuestionsFromText("no-such-user", { rawText: "   " }, neverCallOpenAI()),
    ).rejects.toMatchObject({ code: "validation_failed", details: "empty_content" });
  });

  it("văn bản dưới 20 ký tự → validation_failed, không gọi OpenAI", async () => {
    await expect(
      extractQuestionsFromText("no-such-user", { rawText: "ngắn quá" }, neverCallOpenAI()),
    ).rejects.toMatchObject({ code: "validation_failed", details: "too_short" });
  });

  it("văn bản trên 20.000 ký tự → validation_failed, không gọi OpenAI", async () => {
    const huge = "a".repeat(20_001);
    await expect(
      extractQuestionsFromText("no-such-user", { rawText: huge }, neverCallOpenAI()),
    ).rejects.toMatchObject({ code: "validation_failed", details: "too_long" });
  });
});

describe("extractQuestionsFromText — ví token AI", () => {
  it("hết hạn mức: bị chặn TRƯỚC khi gọi OpenAI (không tốn tiền)", async () => {
    const userId = await makeUser("no-budget");
    const budget = await getTokenBudget(userId);
    await chargeTokens(userId, budget.monthlyRemaining, null);

    await expect(
      extractQuestionsFromText(
        userId,
        { rawText: "Câu 1: Thủ đô VN là gì? A. Hà Nội B. Huế Đáp án: A" },
        neverCallOpenAI(),
      ),
    ).rejects.toBeInstanceOf(AiTutorError);
  });

  it("gọi thành công: usage được ghi vào ví (trừ đúng số token)", async () => {
    const userId = await makeUser("charges");
    const before = await getTokenBudget(userId);

    await extractQuestionsFromText(
      userId,
      { rawText: "Câu 1: Thủ đô VN là gì? A. Hà Nội B. Huế Đáp án: A" },
      fakeOpenAI([sampleQuestion], [], 500, 300),
    );

    const after = await getTokenBudget(userId);
    expect(before.monthlyRemaining - after.monthlyRemaining).toBe(800);
  });
});

describe("extractQuestionsFromText — output", () => {
  it("trả đúng mảng câu hỏi AI sinh ra, giữ nguyên field", async () => {
    const userId = await makeUser("output");
    const r = await extractQuestionsFromText(
      userId,
      { rawText: "Câu 1: Thủ đô VN là gì? A. Hà Nội B. Huế Đáp án: A" },
      fakeOpenAI([sampleQuestion]),
    );
    expect(r.questions).toEqual([sampleQuestion]);
    expect(r.skipped).toEqual([]);
  });

  it("AI trả mảng rỗng (không tìm thấy câu hỏi nào): không lỗi, trả rỗng", async () => {
    const userId = await makeUser("empty-result");
    const r = await extractQuestionsFromText(
      userId,
      { rawText: "Đoạn văn bản này không chứa câu hỏi nào cả, chỉ là mô tả." },
      fakeOpenAI([]),
    );
    expect(r.questions).toEqual([]);
    expect(r.skipped).toEqual([]);
  });

  it("văn bản có câu Sắp xếp/Ghép cặp: AI báo lại đã bỏ qua thay vì ép vào mcq", async () => {
    // Bug thật: trước khi sửa prompt, AI từng ép câu "Sắp xếp thứ tự" và "Ghép
    // cặp" vào type=mcq (coi mỗi mảnh/cặp là 1 "option") — sai hoàn toàn về
    // ngữ nghĩa, và validate xác định (chỉ kiểm hình thức mcq) không bắt được
    // lỗi này vì nó không biết câu gốc vốn là loại khác.
    const userId = await makeUser("skip-report");
    const r = await extractQuestionsFromText(
      userId,
      { rawText: "Sắp xếp thứ tự câu: 邮局 / 我 / 去 / 寄 / 包裹\nGhép cặp từ Hán với nghĩa: A. 寄 B. 包裹" },
      fakeOpenAI(
        [],
        [
          { reason: "Câu sắp xếp thứ tự — chưa hỗ trợ qua Nhập bằng AI" },
          { reason: "Câu ghép cặp — chưa hỗ trợ qua Nhập bằng AI" },
        ],
      ),
    );
    expect(r.questions).toEqual([]);
    expect(r.skipped).toHaveLength(2);
    expect(r.skipped[0]!.reason).toContain("sắp xếp");
  });

  it("hỗ trợ ordering/matching/fill_in (không còn ép vào mcq)", async () => {
    const userId = await makeUser("new-types");
    const orderingQ = {
      type: "ordering",
      prompt: "Sắp xếp thành câu đúng",
      items: [{ label: "邮局" }, { label: "我" }, { label: "去" }],
      explanation: null,
      topic: null,
    };
    const matchingQ = {
      type: "matching",
      prompt: "Ghép từ Hán với nghĩa",
      pairs: [{ left: "寄", right: "gửi" }],
      explanation: null,
      topic: null,
    };
    const fillInQ = {
      type: "fill_in",
      prompt: "我明天＿＿上海。",
      acceptedAnswers: ["去", "qù"],
      explanation: null,
      topic: null,
    };
    const r = await extractQuestionsFromText(
      userId,
      { rawText: "Sắp xếp / Ghép cặp / Điền khuyết — văn bản mẫu đủ dài để qua ngưỡng tối thiểu" },
      fakeOpenAI([orderingQ, matchingQ, fillInQ]),
    );
    expect(r.questions).toEqual([orderingQ, matchingQ, fillInQ]);
  });

  it("skipped thiếu trong output (model cũ/lệch schema): coi như rỗng, không crash", async () => {
    const userId = await makeUser("skip-missing");
    const openaiNoSkippedField = {
      chat: {
        completions: {
          create: async () => ({
            choices: [{ message: { content: JSON.stringify({ questions: [sampleQuestion] }) } }],
            usage: { prompt_tokens: 10, completion_tokens: 5 },
          }),
        },
      },
    } as unknown as OpenAI;
    const r = await extractQuestionsFromText(
      userId,
      { rawText: "Câu 1: Thủ đô VN là gì? A. Hà Nội B. Huế Đáp án: A" },
      openaiNoSkippedField,
    );
    expect(r.skipped).toEqual([]);
  });

  it("OpenAI trả JSON hỏng: ném json_parse_failed", async () => {
    const userId = await makeUser("bad-json");
    const badOpenai = {
      chat: {
        completions: {
          create: async () => ({
            choices: [{ message: { content: "không phải json" } }],
            usage: { prompt_tokens: 10, completion_tokens: 5 },
          }),
        },
      },
    } as unknown as OpenAI;

    await expect(
      extractQuestionsFromText(userId, { rawText: "Câu 1: A. x B. y Đáp án: A" }, badOpenai),
    ).rejects.toMatchObject({ code: "json_parse_failed" });
  });
});
