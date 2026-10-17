import { describe, expect, it } from "vitest";
import type OpenAI from "openai";
import { prisma } from "@feedbackme/db";
import type { SourcePara } from "@feedbackme/shared-types";
import { buildSourcePrompt, generateLessonOutline } from "../aiTutor/lessonOutline";

/** Mốc 2 — AI lập dàn ý bài học từ tài liệu đã tách đoạn (D3). */

function fakeOpenAI(payload: unknown, seen: { user?: string; system?: string } = {}): OpenAI {
  return {
    chat: {
      completions: {
        create: async (req: { messages: Array<{ role: string; content: string }> }) => {
          seen.system = req.messages[0]?.content;
          seen.user = req.messages[1]?.content;
          return {
            choices: [{ message: { content: JSON.stringify(payload) } }],
            usage: { prompt_tokens: 1200, completion_tokens: 400 },
          };
        },
      },
    },
  } as unknown as OpenAI;
}

async function makeUser() {
  const u = await prisma.user.create({
    data: { email: `lo-${Date.now()}-${Math.random()}@e.com`, passwordHash: "x", displayName: "GV" },
  });
  return u.id;
}

const PARAS: SourcePara[] = [
  { t: "Nguyên tắc gần nhau phát biểu rằng mắt người gom các phần tử đặt gần nhau thành một nhóm. ".repeat(3) },
  { img: "/api/lesson-media/images/a.png", alt: "Ba nhóm ô vuông" },
  { t: "Khoảng trắng cho người đọc biết ranh giới giữa các nhóm thông tin. ".repeat(3) },
];

describe("generateLessonOutline", () => {
  it("lời nhắc đánh số đoạn từ 1, ghi rõ ảnh; kết quả đổi về chỉ số từ 0 và ghi sổ token", async () => {
    const userId = await makeUser();
    const seen: { user?: string } = {};
    const openai = fakeOpenAI(
      {
        lessons: [
          {
            title: "Nguyên tắc gần nhau",
            objectives: ["Trình bày được nguyên tắc gần nhau."],
            sections: [{ title: "Khái niệm", layout: "image", points: ["Ý."], boxes: [], paras: [1, 2] }],
          },
        ],
      },
      seen,
    );
    const out = await generateLessonOutline(userId, { sourceName: "bai.docx", paras: PARAS, words: 90 }, openai);
    expect(seen.user).toContain("[1] Nguyên tắc gần nhau");
    expect(seen.user).toContain("[2] [ẢNH: Ba nhóm ô vuông]");
    expect(out.lessons[0]?.sections[0]?.paras).toEqual([0, 1]);
    const log = await prisma.aiUsageLog.findFirst({ where: { userId } });
    expect((log?.tokensInput ?? 0) + (log?.tokensOutput ?? 0)).toBe(1600);
  });

  it("tài liệu quá ngắn: báo lỗi, không gọi mô hình", async () => {
    let called = false;
    const openai = {
      chat: { completions: { create: async () => ((called = true), {}) } },
    } as unknown as OpenAI;
    await expect(
      generateLessonOutline("u", { sourceName: "x", paras: [{ t: "ngắn" }], words: 1 }, openai),
    ).rejects.toMatchObject({ code: "validation_failed", details: "source_too_short" });
    expect(called).toBe(false);
  });

  it("tài liệu dài: từng đoạn được rút gọn đều để vừa ngân sách, không đoạn nào bị bỏ", () => {
    const many: SourcePara[] = Array.from({ length: 300 }, (_, i) => ({ t: `Đoạn ${i} `.repeat(80) }));
    const prompt = buildSourcePrompt("dai.pdf", many, 50_000);
    expect(prompt).toContain("[300] ");
    expect(prompt).toContain("đã được rút gọn");
    expect(prompt.length).toBeLessThan(60_000);
  });
});
