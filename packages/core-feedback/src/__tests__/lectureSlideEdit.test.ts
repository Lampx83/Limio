import { describe, expect, it } from "vitest";
import type OpenAI from "openai";
import { prisma } from "@feedbackme/db";
import { AiTutorError } from "../aiTutor/errors";
import { chargeTokens, getTokenBudget } from "../aiTutor/tokenWallet";
import { buildSlideEditPrompt, generateSlideEdit, type SlideEditInput } from "../aiTutor/lectureSlideEdit";

const base: SlideEditInput = {
  action: "shorter",
  sourceText: "Phản hồi là thông tin về khoảng cách giữa kết quả và mục tiêu. ".repeat(4),
  deckTitle: "Phản hồi",
  targetKey: "cards",
  current: { layout: "cards", title: "Ba câu hỏi", items: [{ heading: "Mục tiêu", body: "Người học biết cần đạt điều gì." }] },
};
const fake = (content: unknown) => ({ chat: { completions: { create: async () => ({ choices: [{ message: { content: JSON.stringify(content) } }], usage: { prompt_tokens: 500, completion_tokens: 300 } }) } } }) as unknown as OpenAI;
const never = () => ({ chat: { completions: { create: async () => { throw new Error("KHÔNG được gọi mô hình"); } } } }) as unknown as OpenAI;
async function makeUser(slug: string) {
  return (await prisma.user.create({ data: { email: `edit-${slug}-${Date.now()}@e.com`, passwordHash: "x", displayName: slug } })).id;
}
const draft = { index: 0, title: "T", subtitle: "", byline: "", sectionNumber: "", bullets: [], items: [], columns: [], footnote: "", quote: "", source: "", question: "", options: [], prompt: "", notes: "n" };

describe("buildSlideEditPrompt", () => {
  it("mỗi hành động có yêu cầu riêng và có slide hiện tại", () => {
    expect(buildSlideEditPrompt(base).system).toContain("NGẮN GỌN");
    expect(buildSlideEditPrompt({ ...base, action: "example" }).system).toContain("MỘT VÍ DỤ");
    expect(buildSlideEditPrompt({ ...base, action: "simpler" }).system).toContain("ĐƠN GIẢN");
    const quiz = buildSlideEditPrompt({ ...base, action: "to_quiz", targetKey: "quiz" });
    expect(quiz.system).toContain("câu hỏi trắc nghiệm");
    expect(quiz.user).toContain("ĐÚNG 1 phần tử correct=true");
    expect(buildSlideEditPrompt(base).user).toContain('"Ba câu hỏi"');
  });
  it("dàn ý gốc chỉ xuất hiện khi có; thiếu tài liệu thì nói rõ", () => {
    const p = buildSlideEditPrompt({ ...base, action: "rewrite", outlineTitle: "Ba câu hỏi", outlinePoints: ["Mục tiêu: x."], sourceText: "" });
    expect(p.user).toContain("Dòng dàn ý gốc");
    expect(p.user).toContain("Không có tài liệu gốc");
    expect(buildSlideEditPrompt(base).user).not.toContain("Dòng dàn ý gốc");
  });
  it("quy tắc cứng: câu hoàn chỉnh, không emoji, không bịa số liệu", () => {
    const { system } = buildSlideEditPrompt(base);
    expect(system).toContain("CÂU HOÀN CHỈNH");
    expect(system).toMatch(/emoji/i);
    expect(system).toContain("không bịa số liệu");
  });
});

describe("generateSlideEdit", () => {
  it("hành động lạ bị từ chối", async () => {
    await expect(generateSlideEdit("u", { ...base, action: "xoa" as never }, never())).rejects.toMatchObject({ code: "validation_failed" });
  });
  it("hết hạn mức: chặn trước khi gọi mô hình", async () => {
    const userId = await makeUser("cap");
    await chargeTokens(userId, (await getTokenBudget(userId)).monthlyRemaining, null);
    await expect(generateSlideEdit(userId, base, never())).rejects.toBeInstanceOf(AiTutorError);
  });
  it("thành công: trả slide đầu tiên và trừ token", async () => {
    const userId = await makeUser("ok");
    const before = await getTokenBudget(userId);
    const out = await generateSlideEdit(userId, base, fake({ slides: [draft, { ...draft, index: 1 }] }));
    expect(out.index).toBe(0);
    expect((await getTokenBudget(userId)).monthlyRemaining).toBeLessThan(before.monthlyRemaining);
  });
  it("không có slide nào thì báo lỗi", async () => {
    const userId = await makeUser("empty");
    await expect(generateSlideEdit(userId, base, fake({ slides: [] }))).rejects.toMatchObject({ code: "json_parse_failed" });
  });
});
