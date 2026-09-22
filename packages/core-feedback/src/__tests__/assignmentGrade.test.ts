import { describe, expect, it } from "vitest";
import type OpenAI from "openai";
import { prisma } from "@feedbackme/db";
import { suggestAssignmentGrade } from "../aiTutor/generators";
import { AiTutorError } from "../aiTutor/errors";
import { chargeTokens, getTokenBudget } from "../aiTutor/tokenWallet";

/**
 * "Gợi ý điểm bằng AI" cho bài nộp assignment — CHỈ trả gợi ý, không ghi DB
 * (route/UI mới là nơi lưu, sau khi GV bấm "Chấm điểm"). Dùng chung sổ token
 * AI với mọi generator khác (AiUsageLog + ví).
 */

function fakeOpenAI(score: number, feedback = "Bài làm ổn.", rationale = "Đáp ứng 80% rubric."): OpenAI {
  return {
    chat: {
      completions: {
        create: async () => ({
          choices: [{ message: { content: JSON.stringify({ score, feedback, rationale }) } }],
          usage: { prompt_tokens: 400, completion_tokens: 150 },
        }),
      },
    },
  } as unknown as OpenAI;
}

async function makeUser(slug: string) {
  const u = await prisma.user.create({
    data: { email: `agrade-${slug}-${Date.now()}@e.com`, passwordHash: "x", displayName: slug },
  });
  return u.id;
}

const BASE_INPUT = {
  assignmentTitle: "Bài luận",
  assignmentDescription: "Viết 200 từ về chủ đề X",
  maxScore: 10,
  rubricText: "5đ nội dung, 5đ hình thức" as string | null,
  submissionBody: "Đây là bài làm của học viên.",
};

describe("suggestAssignmentGrade — validation", () => {
  it("bài nộp rỗng → validation_failed, không gọi OpenAI", async () => {
    const openai = fakeOpenAI(8);
    await expect(
      suggestAssignmentGrade("no-such-user", { ...BASE_INPUT, submissionBody: "   " }, openai),
    ).rejects.toMatchObject({ code: "validation_failed", details: "empty_submission" });
  });
});

describe("suggestAssignmentGrade — happy path", () => {
  it("trả điểm/feedback/rationale + ghi AiUsageLog đúng token", async () => {
    const userId = await makeUser("ok");
    const openai = fakeOpenAI(8, "Nội dung tốt, hình thức cần gọn hơn.", "Đủ 2 tiêu chí rubric, trừ 2đ trình bày.");

    const r = await suggestAssignmentGrade(userId, BASE_INPUT, openai);
    expect(r.score).toBe(8);
    expect(r.feedback).toContain("Nội dung tốt");
    expect(r.rationale).toContain("rubric");

    const dayKey = new Date().toISOString().slice(0, 10);
    const log = await prisma.aiUsageLog.findUnique({
      where: { userId_dayKey_model: { userId, dayKey, model: "gpt-4o-mini" } },
    });
    expect(log?.tokensInput).toBe(400);
    expect(log?.tokensOutput).toBe(150);
  });

  it("điểm AI trả vượt maxScore hoặc âm đều bị kẹp về [0, maxScore]", async () => {
    const userId1 = await makeUser("over");
    const overScore = await suggestAssignmentGrade(userId1, BASE_INPUT, fakeOpenAI(999));
    expect(overScore.score).toBe(BASE_INPUT.maxScore);

    const userId2 = await makeUser("under");
    const underScore = await suggestAssignmentGrade(userId2, BASE_INPUT, fakeOpenAI(-5));
    expect(underScore.score).toBe(0);
  });

  it("không có rubric vẫn chấm được (rubricText null)", async () => {
    const userId = await makeUser("norubric");
    const r = await suggestAssignmentGrade(
      userId,
      { ...BASE_INPUT, rubricText: null },
      fakeOpenAI(6, "Ổn.", "Chấm không có rubric, dựa theo đề bài."),
    );
    expect(r.score).toBe(6);
  });
});

describe("suggestAssignmentGrade — hạn mức ví token", () => {
  it("hết ví tháng → AiTutorError, KHÔNG gọi OpenAI", async () => {
    const userId = await makeUser("broke");
    const budget = await getTokenBudget(userId);
    await chargeTokens(userId, budget.total - 100, null);

    let called = false;
    const openai = {
      chat: {
        completions: {
          create: async () => {
            called = true;
            return { choices: [{ message: { content: "{}" } }], usage: {} };
          },
        },
      },
    } as unknown as OpenAI;

    await expect(suggestAssignmentGrade(userId, BASE_INPUT, openai)).rejects.toBeInstanceOf(AiTutorError);
    expect(called).toBe(false);
  });
});
