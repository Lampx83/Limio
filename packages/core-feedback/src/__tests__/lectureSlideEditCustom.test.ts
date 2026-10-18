import { describe, expect, it } from "vitest";
import type OpenAI from "openai";
import { prisma } from "@feedbackme/db";
import {
  SLIDE_EDIT_ACTIONS,
  SLIDE_EDIT_INSTRUCTION_MAX,
  buildSlideEditPrompt,
  generateSlideEdit,
  type SlideEditInput,
} from "../aiTutor/lectureSlideEdit";

/** Nhờ AI sửa slide theo yêu cầu riêng do giảng viên gõ (ô "Yêu cầu riêng" ở tab Nhờ AI). */

const base: SlideEditInput = {
  action: "custom",
  instruction: "Thêm một câu hỏi gợi mở ở cuối, giữ ba ý.",
  sourceText: "Phản hồi là thông tin về khoảng cách giữa kết quả và mục tiêu. ".repeat(4),
  deckTitle: "Phản hồi",
  targetKey: "image",
  current: { layout: "image", title: "Phản hồi là gì", bullets: ["Phản hồi chỉ ra khoảng cách."] },
};
const draft = { index: 0, title: "T", subtitle: "", byline: "", sectionNumber: "", bullets: ["Một câu."], items: [], columns: [], footnote: "", quote: "", source: "", question: "", options: [], prompt: "", notes: "n" };
const never = () => ({ chat: { completions: { create: async () => { throw new Error("KHÔNG được gọi mô hình"); } } } }) as unknown as OpenAI;

describe("yêu cầu riêng của giảng viên", () => {
  it("là một hành động hợp lệ", () => {
    expect(SLIDE_EDIT_ACTIONS).toContain("custom");
  });

  it("câu lệnh đưa nguyên văn yêu cầu, nằm trong khung dữ liệu, không vượt quy tắc cứng", () => {
    const { system, user } = buildSlideEditPrompt(base);
    expect(system).toContain("YÊU CẦU CỦA GIẢNG VIÊN");
    expect(system).toMatch(/không được vượt/);
    expect(system).toContain("CÂU HOÀN CHỈNH");
    expect(user).toContain("# Yêu cầu của giảng viên");
    expect(user).toContain(base.instruction);
    // Hành động khác không mang ô yêu cầu.
    expect(buildSlideEditPrompt({ ...base, action: "shorter" }).user).not.toContain("# Yêu cầu của giảng viên");
  });

  it("cắt yêu cầu quá dài; vẫn giữ luật nguồn của bài từ mô tả chủ đề", () => {
    const long = buildSlideEditPrompt({ ...base, instruction: "a".repeat(SLIDE_EDIT_INSTRUCTION_MAX + 300) });
    expect(long.user).not.toContain("a".repeat(SLIDE_EDIT_INSTRUCTION_MAX + 1));
    expect(buildSlideEditPrompt({ ...base, sourceKind: "topic" }).system).toMatch(/KHÔNG đưa con số cụ thể/);
  });

  it("yêu cầu trống hoặc quá ngắn: báo lỗi, không gọi mô hình", async () => {
    await expect(generateSlideEdit("u", { ...base, instruction: "  " }, never())).rejects.toMatchObject({ code: "validation_failed", details: "instruction" });
    await expect(generateSlideEdit("u", { ...base, instruction: undefined }, never())).rejects.toMatchObject({ details: "instruction" });
  });

  it("thành công: gọi mô hình một lần", async () => {
    const u = await prisma.user.create({ data: { email: `edit-custom-${Date.now()}@e.com`, passwordHash: "x", displayName: "c" } });
    let calls = 0;
    const client = {
      chat: { completions: { create: async () => { calls++; return { choices: [{ message: { content: JSON.stringify({ slides: [draft] }) } }], usage: { prompt_tokens: 100, completion_tokens: 100 } }; } } },
    } as unknown as OpenAI;
    const out = await generateSlideEdit(u.id, base, client);
    expect(out.bullets).toEqual(["Một câu."]);
    expect(calls).toBe(1);
  });
});
