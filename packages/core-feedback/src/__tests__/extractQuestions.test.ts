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
  inputTokens = 500,
  outputTokens = 300,
): OpenAI {
  return {
    chat: {
      completions: {
        create: async () => ({
          choices: [{ message: { content: JSON.stringify({ questions }) } }],
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
      fakeOpenAI([sampleQuestion], 500, 300),
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
  });

  it("AI trả mảng rỗng (không tìm thấy câu hỏi nào): không lỗi, trả rỗng", async () => {
    const userId = await makeUser("empty-result");
    const r = await extractQuestionsFromText(
      userId,
      { rawText: "Đoạn văn bản này không chứa câu hỏi nào cả, chỉ là mô tả." },
      fakeOpenAI([]),
    );
    expect(r.questions).toEqual([]);
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
