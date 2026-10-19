import { describe, expect, it } from "vitest";
import type OpenAI from "openai";
import { prisma } from "@feedbackme/db";
import { AiGenerationError } from "../aiTutor/generators";
import { AiTutorError } from "../aiTutor/errors";
import { chargeTokens, getTokenBudget } from "../aiTutor/tokenWallet";
import {
  OUTLINE_KINDS,
  OUTLINE_MAX_SOURCE_CHARS,
  buildOutlinePrompt,
  generateLectureOutline,
  type LectureOutlineInput,
} from "../aiTutor/lectureOutline";

/**
 * Bước "tài liệu → dàn ý" của bài giảng tương tác. AI chỉ ĐỀ XUẤT; việc ép số slide,
 * bố cục, bỏ emoji nằm ở apps/web/src/lib/limioLiveOutline.ts. Ở đây kiểm tra: lời nhắc
 * mang đúng ràng buộc, chặn trước khi tốn tiền, ghi lượng dùng.
 */

const SOURCE = "Phản hồi là thông tin về khoảng cách giữa kết quả hiện tại và mục tiêu học tập. ".repeat(10);
const base: LectureOutlineInput = { sourceText: SOURCE, minutes: 30, minSlides: 14, maxSlides: 18 };

function fakeOpenAI(content: unknown, inputTokens = 800, outputTokens = 900): { client: OpenAI; calls: unknown[] } {
  const calls: unknown[] = [];
  const client = {
    chat: {
      completions: {
        create: async (args: unknown) => {
          calls.push(args);
          return {
            choices: [{ message: { content: typeof content === "string" ? content : JSON.stringify(content) } }],
            usage: { prompt_tokens: inputTokens, completion_tokens: outputTokens },
          };
        },
      },
    },
  } as unknown as OpenAI;
  return { client, calls };
}

const neverCall = (): OpenAI =>
  ({ chat: { completions: { create: async () => { throw new Error("KHÔNG được gọi mô hình"); } } } }) as unknown as OpenAI;

async function makeUser(slug: string) {
  const u = await prisma.user.create({
    data: { email: `outline-${slug}-${Date.now()}@e.com`, passwordHash: "x", displayName: slug },
  });
  return u.id;
}

describe("buildOutlinePrompt", () => {
  it("nêu số slide, thời lượng, tần suất tương tác và các quy tắc cứng", () => {
    const { system } = buildOutlinePrompt(base);
    expect(system).toContain("từ 14 đến 18 slide");
    expect(system).toContain("30 phút");
    expect(system).toContain("MỖI phần nội dung có 1 đến 2 slide tương tác");
    expect(system).toMatch(/emoji/i);
    expect(system).toContain("không bịa số liệu");
  });

  it("hook: chọn một kỹ thuật mở bài, slide trình bày rồi slide tương tác thu câu trả lời, không bịa", () => {
    const { system } = buildOutlinePrompt(base);
    for (const t of ["Câu hỏi khiêu khích", "Hãy hình dung", "Nhận định trái trực giác", "Câu đố mở", "Dự đoán nhanh", "Liên hệ trải nghiệm"]) expect(system).toContain(t);
    expect(system).toContain("CHỈ khi con số hay câu nói đó có trong tài liệu");
    expect(system).toContain(`"hook" (phần "Dẫn dắt vào bài"): ĐÚNG 2 slide`);
    expect(system).toMatch(/KHÔNG đặt kiểu "Giới thiệu"/);
    expect(system).toContain("Không bịa giai thoại");
  });

  it("tổng kết: slide Tóm tắt rồi slide kết bài bố cục quote, câu tự viết không gán cho ai", () => {
    const { system } = buildOutlinePrompt(base);
    expect(system).toContain(`"summary": ĐÚNG 2 slide cuối bài`);
    expect(system).toMatch(/Slide kết bài, layout "quote": MỘT câu đáng nhớ/);
    expect(system).toContain("Không bao giờ gán câu tự viết cho bất kỳ ai");
    expect(system).toContain("khép lại vòng đó");
  });

  it("buổi ngắn: hook 1 đến 2 slide, vẫn có slide kết", () => {
    const { system } = buildOutlinePrompt({ ...base, minutes: 15, minSlides: 9, maxSlides: 12 });
    expect(system).toContain(`"hook" (phần "Dẫn dắt vào bài"): 1 đến 2 slide`);
    expect(system).toContain("Slide kết bài");
  });

  it("cho phép ba loại slide cộng tác nhưng dặn dùng tiết kiệm, và không đặt ở đầu hoặc cuối bài", () => {
    const { system } = buildOutlinePrompt(base);
    for (const k of ["collaborate_board", "draw_it", "whiteboard"]) expect(system).toContain(`"${k}"`);
    expect(system).toMatch(/tiết kiệm|tối đa một/);
    expect(OUTLINE_KINDS).toEqual(["content", "quiz", "poll", "word_cloud", "collaborate_board", "draw_it", "whiteboard"]);
  });

  it("buổi từ 30 phút: mạch đủ Bìa, Mục tiêu, Mục lục, Hook, phần Nội dung có slide mở phần, Tổng kết", () => {
    const { system } = buildOutlinePrompt(base);
    for (const r of ["cover", "objectives", "agenda", "hook", "content", "summary"]) expect(system).toContain(`"${r}"`);
    expect(system).toContain("Người học");
    expect(system).toMatch(/Slide ĐẦU của mỗi phần có layout "section"/);
    expect(system).toMatch(/Không bịa giai thoại/);
  });

  it("buổi 15 phút: mạch gọn, không slide mở phần, không Mục tiêu và Mục lục riêng", () => {
    const { system } = buildOutlinePrompt({ ...base, minutes: 15, minSlides: 8, maxSlides: 10 });
    expect(system).toContain(`KHÔNG dùng layout "section"`);
    expect(system).toContain(`Không có slide "objectives" hay "agenda"`);
    expect(buildOutlinePrompt({ ...base, structure: "compact" }).system).toContain(`KHÔNG dùng layout "section"`);
  });

  it("cắt tài liệu quá dài ở mức cho phép", () => {
    const { user } = buildOutlinePrompt({ ...base, sourceText: "a".repeat(OUTLINE_MAX_SOURCE_CHARS + 5000) });
    expect(user.length).toBeLessThan(OUTLINE_MAX_SOURCE_CHARS + 200);
  });
});

describe("generateLectureOutline", () => {
  it("tài liệu quá ngắn: báo lỗi và KHÔNG gọi mô hình", async () => {
    await expect(generateLectureOutline("u", { ...base, sourceText: "ngắn" }, neverCall())).rejects.toMatchObject({
      code: "validation_failed",
      details: "too_short",
    });
  });

  it("khoảng slide vô lý bị từ chối", async () => {
    await expect(
      generateLectureOutline("u", { ...base, minSlides: 20, maxSlides: 10 }, neverCall()),
    ).rejects.toBeInstanceOf(AiGenerationError);
  });

  it("hết hạn mức: bị chặn TRƯỚC khi gọi mô hình", async () => {
    const userId = await makeUser("no-budget");
    const budget = await getTokenBudget(userId);
    await chargeTokens(userId, budget.monthlyRemaining, null);
    await expect(generateLectureOutline(userId, base, neverCall())).rejects.toBeInstanceOf(AiTutorError);
  });

  it("thành công: trả dàn ý thô và ghi lượng dùng vào ví", async () => {
    const userId = await makeUser("ok");
    const outline = {
      title: "Phản hồi trong dạy học",
      slides: [{ kind: "content", layout: "cover", title: "Phản hồi trong dạy học", points: ["Phản hồi giúp người học tiến bộ."] }],
    };
    const { client, calls } = fakeOpenAI(outline);
    const before = await getTokenBudget(userId);
    const out = await generateLectureOutline(userId, base, client);
    expect(out.title).toBe("Phản hồi trong dạy học");
    expect(out.slides).toHaveLength(1);
    expect(calls).toHaveLength(1);
    const after = await getTokenBudget(userId);
    expect(after.monthlyRemaining).toBeLessThan(before.monthlyRemaining);
  });

  it("mô hình trả JSON hỏng hoặc sai hình dạng thì báo lỗi, không trả rác", async () => {
    const userId = await makeUser("bad");
    await expect(generateLectureOutline(userId, base, fakeOpenAI("không phải json").client)).rejects.toMatchObject({ code: "json_parse_failed" });
    await expect(generateLectureOutline(userId, base, fakeOpenAI({ title: "x" }).client)).rejects.toMatchObject({ code: "json_parse_failed" });
  });
});
