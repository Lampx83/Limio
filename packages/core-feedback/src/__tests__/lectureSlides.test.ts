import { describe, expect, it } from "vitest";
import type OpenAI from "openai";
import { prisma } from "@feedbackme/db";
import { AiTutorError } from "../aiTutor/errors";
import { chargeTokens, getTokenBudget } from "../aiTutor/tokenWallet";
import { buildSlidesPrompt, generateSlideDrafts, specKeyFor, type OutlineSlideInput } from "../aiTutor/lectureSlides";

const outline: OutlineSlideInput[] = [
  { index: 0, kind: "content", layout: "cover", title: "Phản hồi trong dạy học", points: ["Phản hồi giúp người học tiến bộ."] },
  { index: 1, kind: "content", layout: "cards", title: "Ba câu hỏi", points: ["Mục tiêu: nêu rõ đích đến."] },
  { index: 2, kind: "quiz", layout: null, title: "Câu nào là phản hồi cụ thể?", points: [] },
  { index: 3, kind: "word_cloud", layout: null, title: "Một từ nói về cảm nhận", points: [] },
];
const base = { sourceText: "Phản hồi là thông tin về khoảng cách giữa kết quả và mục tiêu. ".repeat(5), deckTitle: "Phản hồi", outline };

const fake = (content: unknown) => {
  const calls: unknown[] = [];
  const client = {
    chat: { completions: { create: async (a: unknown) => { calls.push(a); return { choices: [{ message: { content: JSON.stringify(content) } }], usage: { prompt_tokens: 900, completion_tokens: 700 } }; } } },
  } as unknown as OpenAI;
  return { client, calls };
};
const never = () => ({ chat: { completions: { create: async () => { throw new Error("KHÔNG được gọi mô hình"); } } } }) as unknown as OpenAI;
async function makeUser(slug: string) {
  return (await prisma.user.create({ data: { email: `slides-${slug}-${Date.now()}@e.com`, passwordHash: "x", displayName: slug } })).id;
}

describe("buildSlidesPrompt", () => {
  it("chỉ yêu cầu các chỉ số trong lô, kèm đặc tả theo bố cục", () => {
    const { user, system } = buildSlidesPrompt({ ...base, batch: [1, 2] });
    expect(user).toContain("Chỉ số 1, bố cục \"cards\"");
    expect(user).toContain("Chỉ số 2, bố cục \"quiz\"");
    expect(user).not.toContain("Chỉ số 0, bố cục");
    expect(user).toContain("ĐÚNG 4 phần tử, ĐÚNG 1 phần tử correct=true");
    expect(system).toMatch(/emoji/i);
    expect(system).toContain("CÂU HOÀN CHỈNH");
    expect(system).toContain("không bịa số liệu");
  });
  it("toàn bộ dàn ý được đưa vào làm ngữ cảnh", () => {
    const { user } = buildSlidesPrompt({ ...base, batch: [3] });
    for (const s of outline) expect(user).toContain(s.title);
  });
  it("specKeyFor: slide tương tác dùng kind, slide nội dung dùng layout", () => {
    expect(specKeyFor(outline[2]!)).toBe("quiz");
    expect(specKeyFor(outline[0]!)).toBe("cover");
  });
});

describe("generateSlideDrafts", () => {
  it("lô rỗng thì không gọi mô hình", async () => {
    expect(await generateSlideDrafts("u", { ...base, batch: [] }, never())).toEqual([]);
  });
  it("hết hạn mức: chặn trước khi gọi mô hình", async () => {
    const userId = await makeUser("cap");
    await chargeTokens(userId, (await getTokenBudget(userId)).monthlyRemaining, null);
    await expect(generateSlideDrafts(userId, { ...base, batch: [0] }, never())).rejects.toBeInstanceOf(AiTutorError);
  });
  it("thành công: trả bản nháp và ghi lượng dùng", async () => {
    const userId = await makeUser("ok");
    const { client, calls } = fake({ slides: [{ index: 0, title: "T", subtitle: "S", byline: "", sectionNumber: "", bullets: [], items: [], columns: [], footnote: "", quote: "", source: "", question: "", options: [], prompt: "", notes: "Nhấn mạnh." }] });
    const before = await getTokenBudget(userId);
    const out = await generateSlideDrafts(userId, { ...base, batch: [0] }, client);
    expect(out[0]!.notes).toBe("Nhấn mạnh.");
    expect(calls).toHaveLength(1);
    expect((await getTokenBudget(userId)).monthlyRemaining).toBeLessThan(before.monthlyRemaining);
  });
  it("sai hình dạng thì báo lỗi", async () => {
    const userId = await makeUser("bad");
    await expect(generateSlideDrafts(userId, { ...base, batch: [0] }, fake({ nope: 1 }).client)).rejects.toMatchObject({ code: "json_parse_failed" });
  });
});
