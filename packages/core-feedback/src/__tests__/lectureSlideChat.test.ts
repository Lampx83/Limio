import { describe, expect, it } from "vitest";
import type OpenAI from "openai";
import { prisma } from "@feedbackme/db";
import {
  SLIDE_CHAT_HISTORY_TURNS,
  SLIDE_CHAT_MESSAGE_MAX,
  buildSlideChatPrompt,
  generateSlideChat,
  type SlideChatInput,
} from "../aiTutor/lectureSlideChat";

/** Hỏi đáp với AI về một slide (docs/tieu-chi/nho-ai-hoi-dap.md, K6, K12–K14, K17–K18). */

const base: SlideChatInput = {
  sourceText: "Phản hồi là thông tin về khoảng cách giữa kết quả hiện tại và mục tiêu học tập. ".repeat(4),
  deckTitle: "Phản hồi trong dạy học",
  targetKey: "cards",
  current: { layout: "cards", title: "Thứ tự ưu tiên", items: [{ heading: "Hiện trạng", body: "Bài làm cho thấy mức đạt hiện tại." }] },
  outlineTitle: "Thứ tự ưu tiên",
  outlinePoints: ["Hiện trạng: bài làm cho thấy mức đạt."],
  history: [],
  message: "Ý thứ hai có chính xác không?",
};
const never = () => ({ chat: { completions: { create: async () => { throw new Error("KHÔNG được gọi mô hình"); } } } }) as unknown as OpenAI;

describe("buildSlideChatPrompt", () => {
  it("mô tả ba kiểu trả lời và khi nào dùng kiểu nào", () => {
    const { system } = buildSlideChatPrompt(base);
    for (const k of ['"answer"', '"clarify"', '"propose"']) expect(system).toContain(k);
    expect(system).toMatch(/2 đến 3 hướng/);
    expect(system).toMatch(/ĐẦY ĐỦ các trường/);
    expect(system).toMatch(/"suggestion"/);
  });

  it("gửi kèm slide hiện tại, dòng dàn ý, bố cục đích, tài liệu và tin nhắn mới", () => {
    const { user } = buildSlideChatPrompt(base);
    expect(user).toContain('"Thứ tự ưu tiên"');
    expect(user).toContain("# Dòng dàn ý gốc");
    expect(user).toContain('# Bố cục đích: "cards"');
    expect(user).toContain("# Tài liệu");
    expect(user).toContain("# Tin nhắn mới của giảng viên");
    expect(user).toContain(base.message);
  });

  it("chỉ giữ 6 lượt gần nhất của cuộc trò chuyện", () => {
    const history = Array.from({ length: 10 }, (_, i) => ({ role: (i % 2 ? "assistant" : "user") as "user" | "assistant", text: `lượt ${i}` }));
    const { user } = buildSlideChatPrompt({ ...base, history });
    expect(SLIDE_CHAT_HISTORY_TURNS).toBe(6);
    expect(user).not.toContain("lượt 3");
    expect(user).toContain("lượt 4");
    expect(user).toContain("lượt 9");
  });

  it("bài từ tài liệu: chỉ theo tài liệu, nói rõ khi tài liệu không đề cập (K13)", () => {
    const { system } = buildSlideChatPrompt(base);
    expect(system).toMatch(/tài liệu không đề cập/i);
  });

  it("bài từ mô tả chủ đề: kiến thức chung, cấm số liệu; bài có nguồn: ghi số nguồn", () => {
    expect(buildSlideChatPrompt({ ...base, sourceKind: "topic" }).system).toMatch(/KHÔNG đưa con số cụ thể/);
    expect(buildSlideChatPrompt({ ...base, sourceKind: "topic_web" }).system).toMatch(/\[n\]/);
  });

  it("giữ quy tắc văn phong; tin nhắn của giảng viên không vượt quy tắc", () => {
    const { system } = buildSlideChatPrompt(base);
    expect(system).toContain("CÂU HOÀN CHỈNH");
    expect(system).toMatch(/emoji/i);
    expect(system).toMatch(/không được vượt/);
  });

  it("cắt tin nhắn quá dài", () => {
    const { user } = buildSlideChatPrompt({ ...base, message: "a".repeat(SLIDE_CHAT_MESSAGE_MAX + 100) });
    expect(user).not.toContain("a".repeat(SLIDE_CHAT_MESSAGE_MAX + 1));
  });
});

describe("generateSlideChat", () => {
  it("tin nhắn trống: báo lỗi, không gọi mô hình", async () => {
    await expect(generateSlideChat("u", { ...base, message: "  " }, never())).rejects.toMatchObject({ code: "validation_failed", details: "message" });
  });

  it("thành công: một lần gọi, lược đồ có kind, reply, options, suggestion, draft", async () => {
    const u = await prisma.user.create({ data: { email: `chat-${Date.now()}@e.com`, passwordHash: "x", displayName: "c" } });
    const calls: Array<Record<string, any>> = [];
    const client = {
      chat: {
        completions: {
          create: async (args: Record<string, any>) => {
            calls.push(args);
            return { choices: [{ message: { content: JSON.stringify({ kind: "answer", reply: "Đúng.", options: [], suggestion: "", draft: {} }) } }], usage: { prompt_tokens: 100, completion_tokens: 50 } };
          },
        },
      },
    } as unknown as OpenAI;
    const out = await generateSlideChat(u.id, base, client);
    expect(out.kind).toBe("answer");
    expect(calls).toHaveLength(1);
    const props = calls[0]!.response_format.json_schema.schema.properties;
    expect(Object.keys(props).sort()).toEqual(["draft", "kind", "options", "reply", "suggestion"]);
    expect(props.kind.enum).toEqual(["answer", "clarify", "propose"]);
  });
});
