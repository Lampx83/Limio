import { describe, expect, it } from "vitest";
import type OpenAI from "openai";
import { prisma } from "@feedbackme/db";
import { AiTutorError } from "../aiTutor/errors";
import { chargeTokens, getTokenBudget } from "../aiTutor/tokenWallet";
import { SLIDE_SPEC, buildSlidesPrompt, generateSlideDrafts, specKeyFor, type OutlineSlideInput } from "../aiTutor/lectureSlides";

const outline: OutlineSlideInput[] = [
  { index: 0, kind: "content", layout: "cover", title: "Phản hồi trong dạy học", points: ["Phản hồi giúp người học tiến bộ."] },
  { index: 1, kind: "content", layout: "cards", title: "Ba câu hỏi", points: ["Mục tiêu: nêu rõ đích đến."] },
  { index: 2, kind: "quiz", layout: null, title: "Câu nào là phản hồi cụ thể?", points: [] },
  { index: 3, kind: "word_cloud", layout: null, title: "Một từ nói về cảm nhận", points: [] },
];
describe("vai trò trong mạch bài", () => {
  it("slide Mục tiêu và Mục lục có yêu cầu riêng; slide mở phần dặn lời chuyển ý trong ghi chú", () => {
    expect(specKeyFor({ index: 0, kind: "content", layout: "summary", title: "Mục tiêu", points: [], role: "objectives" })).toBe("objectives");
    expect(specKeyFor({ index: 0, kind: "content", layout: "summary", title: "Nội dung", points: [], role: "agenda" })).toBe("agenda");
    expect(specKeyFor({ index: 0, kind: "content", layout: "summary", title: "Điều cần nhớ", points: [], role: "summary" })).toBe("summary");
    expect(SLIDE_SPEC.section).toContain("chuyển ý");
    expect(SLIDE_SPEC.agenda).toContain("giữ nguyên chữ");
  });

  it("dàn ý tổng quan ghi nhãn phần để mô hình giữ mạch", () => {
    const { user } = buildSlidesPrompt({
      sourceText: "x".repeat(60),
      deckTitle: "T",
      outline: [{ index: 0, kind: "content", layout: "section", title: "Ứng dụng", points: [], role: "content", part: "Nội dung 2: Ứng dụng" }],
      batch: [0],
    });
    expect(user).toContain("0. (Nội dung 2: Ứng dụng) [section] Ứng dụng");
  });
});

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

describe("kind cộng tác", () => {
  const more = [
    ...outline,
    { index: 90, kind: "collaborate_board" as const, layout: null, title: "Dán một vướng mắc", points: [] },
    { index: 91, kind: "draw_it" as const, layout: null, title: "Vẽ sơ đồ", points: [] },
    { index: 92, kind: "whiteboard" as const, layout: null, title: "Giải cùng nhau", points: [] },
  ];
  it("specKeyFor trả đúng khoá và SLIDE_SPEC có đặc tả cho từng loại", () => {
    expect(more.slice(-3).map((s) => specKeyFor(s))).toEqual(["collaborate_board", "draw_it", "whiteboard"]);
    for (const k of ["collaborate_board", "draw_it", "whiteboard"]) expect(SLIDE_SPEC[k]).toContain("prompt");
  });
  it("prompt yêu cầu viết lời nhắc cho học viên với từng loại", () => {
    const { user } = buildSlidesPrompt({ ...base, outline: more, batch: [90, 91, 92] });
    expect(user).toContain("[collaborate_board]");
    expect(user).toContain("[draw_it]");
    expect(user).toContain("[whiteboard]");
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
