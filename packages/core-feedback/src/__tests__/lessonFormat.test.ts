import { describe, expect, it } from "vitest";
import type OpenAI from "openai";
import { prisma } from "@feedbackme/db";
import { formatLessonContent } from "../aiTutor/generators";
import { AiTutorError } from "../aiTutor/errors";
import { chargeTokens, getTokenBudget } from "../aiTutor/tokenWallet";

/**
 * "Định dạng bằng AI" — GV dán nội dung thô vào ô richtext, chọn template,
 * AI trả HTML sạch theo đúng cấu trúc + phong cách. Không chạm DB nào khác
 * ngoài sổ token (AiUsageLog + AiTokenLedger/Balance, dùng chung với AI Tutor).
 */

function fakeOpenAI(html: string, inputTokens = 500, outputTokens = 300): OpenAI {
  return {
    chat: {
      completions: {
        create: async () => ({
          choices: [{ message: { content: JSON.stringify({ html }) } }],
          usage: { prompt_tokens: inputTokens, completion_tokens: outputTokens },
        }),
      },
    },
  } as unknown as OpenAI;
}

async function makeUser(slug: string) {
  const u = await prisma.user.create({
    data: { email: `fmt-${slug}-${Date.now()}@e.com`, passwordHash: "x", displayName: slug },
  });
  return u.id;
}

describe("formatLessonContent — validation (không chạm OpenAI/DB)", () => {
  it("nội dung rỗng → validation_failed, không gọi OpenAI", async () => {
    const openai = fakeOpenAI("<p>x</p>");
    await expect(
      formatLessonContent("no-such-user", { html: "   ", template: "clean" }, openai),
    ).rejects.toMatchObject({ code: "validation_failed", details: "empty_content" });
  });

  it("nội dung vượt 100.000 ký tự → validation_failed", async () => {
    const openai = fakeOpenAI("<p>x</p>");
    const huge = "a".repeat(100_001);
    await expect(
      formatLessonContent("no-such-user", { html: huge, template: "clean" }, openai),
    ).rejects.toMatchObject({ code: "validation_failed", details: "too_long" });
  });

  it("template không hợp lệ → validation_failed", async () => {
    const openai = fakeOpenAI("<p>x</p>");
    await expect(
      formatLessonContent(
        "no-such-user",
        { html: "<p>ok</p>", template: "bogus" as never },
        openai,
      ),
    ).rejects.toMatchObject({ code: "validation_failed", details: "unknown_template" });
  });
});

describe("formatLessonContent — happy path", () => {
  it("trả HTML từ model + ghi AiUsageLog đúng token", async () => {
    const userId = await makeUser("ok");
    const openai = fakeOpenAI("<h2 style=\"color:#1e40af\">Mở đầu</h2><p>chữ</p>", 600, 400);

    const r = await formatLessonContent(
      userId,
      { html: "<p>bài chưa định dạng</p>", template: "clean" },
      openai,
    );

    expect(r.html).toContain("<h2");
    expect(r.html).toContain("Mở đầu");

    const dayKey = new Date().toISOString().slice(0, 10);
    const log = await prisma.aiUsageLog.findUnique({
      where: { userId_dayKey_model: { userId, dayKey, model: "gpt-4o-mini" } },
    });
    expect(log?.tokensInput).toBe(600);
    expect(log?.tokensOutput).toBe(400);
  });

  it("HTML rỗng từ model → openai_error, không nuốt lỗi im lặng", async () => {
    const userId = await makeUser("empty-out");
    const openai = fakeOpenAI("   ");
    await expect(
      formatLessonContent(userId, { html: "<p>x</p>", template: "modern" }, openai),
    ).rejects.toMatchObject({ code: "openai_error", details: "empty_html_output" });
  });

  it("cả 3 template đều chạy được", async () => {
    for (const template of ["clean", "academic", "modern"] as const) {
      const userId = await makeUser(`tpl-${template}`);
      const openai = fakeOpenAI("<h2>ok</h2>");
      const r = await formatLessonContent(userId, { html: "<p>x</p>", template }, openai);
      expect(r.html).toContain("<h2>ok</h2>");
    }
  });
});

describe("formatLessonContent — hạn mức ví token", () => {
  it("hết ví tháng → no_token_budget, KHÔNG gọi OpenAI (chặn trước khi tốn tiền)", async () => {
    const userId = await makeUser("broke");
    // Tiêu gần hết ví trước khi gọi — đủ để rơi dưới RESERVE_TOKENS_PER_TURN.
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

    await expect(
      formatLessonContent(userId, { html: "<p>x</p>", template: "clean" }, openai),
    ).rejects.toBeInstanceOf(AiTutorError);
    expect(called).toBe(false);
  });
});
