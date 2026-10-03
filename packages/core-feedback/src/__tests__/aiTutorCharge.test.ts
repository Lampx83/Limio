import { describe, expect, it } from "vitest";
import type OpenAI from "openai";
import { prisma } from "@feedbackme/db";
import { getOrCreateConversation, runChatTurn } from "../aiTutor/aiTutor";
import { ensureMonthlyGrant } from "../aiTutor/tokenWallet";

function fakeOpenai(promptTokens: number, completionTokens: number) {
  return {
    chat: {
      completions: {
        create: async () =>
          (async function* () {
            yield { choices: [{ delta: { content: "Trả lời." } }] };
            yield {
              choices: [],
              usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens },
            };
          })(),
      },
    },
  } as unknown as OpenAI;
}

async function setup(slug: string) {
  const user = await prisma.user.create({
    data: { email: `chg-${slug}@e.com`, passwordHash: "x", displayName: slug },
  });
  const course = await prisma.course.create({
    data: { slug: `chg-${slug}`, title: "C", description: "x" },
  });
  const mod = await prisma.module.create({
    data: { courseId: course.id, title: "M", orderIndex: 0 },
  });
  const lesson = await prisma.lesson.create({
    data: { moduleId: mod.id, title: "L", orderIndex: 0 },
  });
  const conv = await getOrCreateConversation(user.id, lesson.id);
  return { userId: user.id, convId: conv.id };
}

describe("AI tutor — trừ ví token", () => {
  it("mỗi lượt hỏi trừ đúng số token đã dùng khỏi hạn mức tháng và ghi sổ", async () => {
    const { userId, convId } = await setup("c1");
    const before = await ensureMonthlyGrant(userId);

    await runChatTurn({
      conversationId: convId,
      userId,
      userMessage: "hỏi",
      openai: fakeOpenai(300, 120),
    });

    const after = await prisma.aiTokenBalance.findUniqueOrThrow({ where: { userId } });
    expect(after.monthlyRemaining).toBe(before.monthlyRemaining - 420);

    const ledger = await prisma.aiTokenLedger.findMany({
      where: { userId, kind: "consumption" },
    });
    expect(ledger).toHaveLength(1);
    expect(ledger[0]?.amount).toBe(-420);
  });

  it("vẫn chỉ ghi MỘT dòng AiUsageLog cho lượt hỏi (không đếm đôi)", async () => {
    const { userId, convId } = await setup("c2");
    await runChatTurn({
      conversationId: convId,
      userId,
      userMessage: "hỏi",
      openai: fakeOpenai(100, 50),
    });
    const logs = await prisma.aiUsageLog.findMany({ where: { userId } });
    expect(logs).toHaveLength(1);
    expect(logs[0]?.turns).toBe(1);
    expect(logs[0]!.tokensInput + logs[0]!.tokensOutput).toBe(150);
  });
});
