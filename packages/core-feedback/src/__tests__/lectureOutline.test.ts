import { describe, expect, it } from "vitest";
import type OpenAI from "openai";
import { prisma } from "@feedbackme/db";
import { AiGenerationError } from "../aiTutor/generators";
import { AiTutorError } from "../aiTutor/errors";
import { chargeTokens, getTokenBudget } from "../aiTutor/tokenWallet";
import {
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
const base: LectureOutlineInput = { sourceText: SOURCE, minutes: 30, minSlides: 14, maxSlides: 18, interactiveEvery: 4 };

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
    expect(system).toContain("khoảng 4 slide nội dung");
    expect(system).toMatch(/emoji/i);
    expect(system).toContain("không bịa số liệu");
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
