import { describe, expect, it } from "vitest";
import type OpenAI from "openai";
import { prisma } from "@feedbackme/db";
import {
  MAX_QUOTE_CHARS,
  getOrCreateConversation,
  runChatTurn,
} from "../aiTutor/aiTutor";

/** OpenAI giả: ghi lại messages được gửi đi, trả về một câu trả lời cố định. */
function fakeOpenai() {
  const calls: OpenAI.Chat.ChatCompletionMessageParam[][] = [];
  const client = {
    chat: {
      completions: {
        create: async (args: { messages: OpenAI.Chat.ChatCompletionMessageParam[] }) => {
          calls.push(args.messages);
          return (async function* () {
            yield { choices: [{ delta: { content: "Trả lời." } }] };
            yield { choices: [], usage: { prompt_tokens: 10, completion_tokens: 2 } };
          })();
        },
      },
    },
  } as unknown as OpenAI;
  return { client, calls };
}

async function setup(slug: string) {
  const user = await prisma.user.create({
    data: { email: `q-${slug}@e.com`, passwordHash: "x", displayName: slug },
  });
  const course = await prisma.course.create({
    data: { slug: `q-${slug}`, title: "C", description: "x" },
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

describe("AI tutor — đoạn bôi đen gửi kèm (quote)", () => {
  it("lưu và gửi lên model dưới dạng blockquote trước câu hỏi", async () => {
    const { userId, convId } = await setup("q1");
    const { client, calls } = fakeOpenai();
    await runChatTurn({
      conversationId: convId,
      userId,
      userMessage: "Ý này nghĩa là gì?",
      quote: "dòng một\ndòng hai",
      openai: client,
    });
    const expected = "> dòng một\n> dòng hai\n\nÝ này nghĩa là gì?";
    const last = calls[0]!.at(-1)!;
    expect(last.content).toBe(expected);

    const msgs = await prisma.aiMessage.findMany({
      where: { conversationId: convId },
      orderBy: { createdAt: "asc" },
    });
    expect(msgs[0]?.role).toBe("user");
    expect(msgs[0]?.content).toBe(expected);

    // Tên hội thoại là câu hỏi, không phải đoạn trích.
    const conv = await prisma.aiConversation.findUniqueOrThrow({ where: { id: convId } });
    expect(conv.title).toBe("Ý này nghĩa là gì?");
  });

  it("cắt đoạn trích quá dài để không ăn hết ví token", async () => {
    const { userId, convId } = await setup("q2");
    const { client, calls } = fakeOpenai();
    await runChatTurn({
      conversationId: convId,
      userId,
      userMessage: "hỏi",
      quote: "x".repeat(MAX_QUOTE_CHARS * 3),
      openai: client,
    });
    const sent = String(calls[0]!.at(-1)!.content);
    expect(sent.length).toBeLessThanOrEqual(2 + MAX_QUOTE_CHARS + 2 + "hỏi".length);
  });

  it("không có quote thì giữ nguyên hành vi cũ", async () => {
    const { userId, convId } = await setup("q3");
    const { client, calls } = fakeOpenai();
    await runChatTurn({ conversationId: convId, userId, userMessage: "xin chào", openai: client });
    expect(calls[0]!.at(-1)!.content).toBe("xin chào");
  });
});
