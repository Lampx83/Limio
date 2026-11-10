import { describe, expect, it } from "vitest";
import type OpenAI from "openai";
import { prisma } from "@feedbackme/db";
import {
  chunkParas,
  generateVanDapPlan,
  normalizeCandidates,
  PLAN_PART_BUDGET_CHARS,
  roundRobinPick,
  splitIntoParas,
} from "../aiTutor/vandapPlan";

/** Limio Vấn đáp — Tạo dàn từ tài liệu (AC1.3–AC1.5). */

type Call = { system: string; user: string };

function fakeOpenAI(
  respond: (call: Call, n: number) => unknown,
  calls: Call[] = [],
): OpenAI {
  return {
    chat: {
      completions: {
        create: async (req: { messages: Array<{ role: string; content: string }> }) => {
          const call = { system: req.messages[0]!.content, user: req.messages[1]!.content };
          calls.push(call);
          const out = respond(call, calls.length);
          if (out instanceof Error) throw out;
          return {
            choices: [{ message: { content: JSON.stringify(out) }, finish_reason: "stop" }],
            usage: { prompt_tokens: 1000, completion_tokens: 200 },
          };
        },
      },
    },
  } as unknown as OpenAI;
}

async function makeUser() {
  const u = await prisma.user.create({
    data: { email: `vdp-${Date.now()}-${Math.random()}@e.com`, passwordHash: "x", displayName: "GV" },
  });
  return u.id;
}

const SENTENCE = "Vòng lặp for dùng khi biết trước số lần lặp, còn vòng lặp while dùng khi điều kiện dừng chưa biết trước. ";
const SHORT_DOC = [
  `Giới thiệu vòng lặp\n\n${SENTENCE.repeat(3)}`,
  `Điều kiện dừng\n\n${SENTENCE.repeat(2)}`,
  `Lỗi thường gặp\n\n${SENTENCE.repeat(2)}`,
].join("\n\n");

const cand = (core: string, paras: number[] = [1], extra: object = {}) => ({
  core,
  level: "basic",
  expectedAnswer: `Đáp án cho ${core}`,
  maxFollowUps: 2,
  paras,
  ...extra,
});

describe("tách đoạn và chia phần", () => {
  it("đánh số đoạn liên tục qua nhiều tài liệu và nối dòng quá ngắn vào đoạn kế", () => {
    const paras = splitIntoParas([
      { title: "A", text: `Chương 1\n\n${SENTENCE}\n\n3\n\n${SENTENCE}` },
      { title: "B", text: SENTENCE },
    ]);
    expect(paras.map((p) => p.index)).toEqual([0, 1, 2]);
    expect(paras.map((p) => p.source)).toEqual(["A", "A", "B"]);
    // "Chương 1" (ngắn) được nối vào đoạn sau, không đứng riêng.
    expect(paras[0]!.text.startsWith("Chương 1")).toBe(true);
  });

  it("đoạn quá dài được cắt, và mỗi phần không vượt ngân sách chữ", () => {
    const long = SENTENCE.repeat(40); // ~4 nghìn ký tự, một khối
    const paras = splitIntoParas([{ title: "A", text: long }]);
    expect(paras.length).toBeGreaterThan(1);
    expect(paras.every((p) => p.text.length <= 1200)).toBe(true);
    const many = splitIntoParas([{ title: "A", text: Array.from({ length: 60 }, () => SENTENCE.repeat(8)).join("\n\n") }]);
    const parts = chunkParas(many);
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) expect(part.reduce((n, p) => n + p.text.length, 0)).toBeLessThanOrEqual(PLAN_PART_BUDGET_CHARS);
    expect(parts.flat().map((p) => p.index)).toEqual(many.map((p) => p.index));
  });
});

describe("chuẩn hoá đầu ra của mô hình", () => {
  const paras = splitIntoParas([{ title: "A", text: SHORT_DOC }]);

  it("đoạn nguồn do code ghép từ tài liệu thật; số đoạn bịa không tạo ra chữ", () => {
    const out = normalizeCandidates(
      { items: [cand("Ý có nguồn", [1, 2]), cand("Ý nguồn bịa", [99, -3, 1.5])] },
      paras,
      0,
    );
    expect(out[0]!.sourceExcerpt).toContain("Giới thiệu vòng lặp");
    expect(out[0]!.sourceExcerpt).toContain("Điều kiện dừng");
    expect(out[1]!.sourceExcerpt).toBe("");
  });

  it("ép giá trị về miền hợp lệ, bỏ ý rỗng và ý trùng", () => {
    const out = normalizeCandidates(
      {
        items: [
          cand("Ý A", [1], { level: "legendary", maxFollowUps: 9 }),
          cand("  ý a  "),
          cand("   "),
          cand("Ý B", [1], { maxFollowUps: -4 }),
          { core: "Ý C", paras: "x" },
        ],
      },
      paras,
      0,
    );
    expect(out.map((o) => o.core)).toEqual(["Ý A", "Ý B", "Ý C"]);
    expect(out[0]).toMatchObject({ level: "intermediate", maxFollowUps: 3 });
    expect(out[1]!.maxFollowUps).toBe(0);
    expect(out[2]).toMatchObject({ level: "intermediate", maxFollowUps: 2, expectedAnswer: "", sourceExcerpt: "" });
    expect(normalizeCandidates(null, paras, 0)).toEqual([]);
  });

  it("gộp dự phòng lấy luân phiên giữa các phần", () => {
    const mk = (part: number, n: number) => ({ core: `P${part}-${n}`, sourceExcerpt: "", level: "basic" as const, expectedAnswer: "", maxFollowUps: 2, part });
    const picked = roundRobinPick([mk(0, 1), mk(0, 2), mk(0, 3), mk(1, 1), mk(2, 1)], 4);
    expect(picked.map((c) => c.core)).toEqual(["P0-1", "P1-1", "P2-1", "P0-2"]);
  });
});

describe("generateVanDapPlan", () => {
  it("tài liệu ngắn: một lần đọc, ra 6–12 ý đủ trường, đoạn nguồn từ tài liệu, ghi hạn mức token (AC1.3)", async () => {
    const userId = await makeUser();
    const calls: Call[] = [];
    const items = Array.from({ length: 7 }, (_, i) => cand(`Ý số ${i + 1}`, [1 + (i % 3)], { level: i % 2 ? "advanced" : "basic" }));
    const plan = await generateVanDapPlan(
      userId,
      { materials: [{ title: "Giáo trình", text: SHORT_DOC }], durationMin: 15, language: "vi" },
      fakeOpenAI(() => ({ items }), calls),
    );
    expect(calls).toHaveLength(1);
    expect(plan.parts).toBe(1);
    expect(plan.items).toHaveLength(7);
    expect(plan.items[0]).toMatchObject({ core: "Ý số 1", level: "basic", maxFollowUps: 2 });
    expect(plan.items[0]!.sourceExcerpt).toContain("Giới thiệu vòng lặp");
    expect(plan.items.every((i) => !("part" in i))).toBe(true);
    expect(calls[0]!.user).toContain("[1] Giới thiệu vòng lặp");
    expect(calls[0]!.system).toContain("tiếng Việt");
    const log = await prisma.aiUsageLog.findFirst({ where: { userId } });
    expect((log?.tokensInput ?? 0) + (log?.tokensOutput ?? 0)).toBe(1200);
  });

  it("tài liệu dài: sinh theo từng phần rồi gộp, phần sau không bị cắt mất (AC1.4)", async () => {
    const userId = await makeUser();
    const calls: Call[] = [];
    const blocks = Array.from({ length: 60 }, (_, i) => `Mục ${i + 1}\n\n${SENTENCE.repeat(8)}`);
    blocks[59] = `Mục cuối CHỈ-CÓ-Ở-CUỐI\n\n${SENTENCE.repeat(8)}`;
    const text = blocks.join("\n\n");
    const plan = await generateVanDapPlan(
      userId,
      { materials: [{ title: "Dài", text }], durationMin: 30, language: "vi" },
      fakeOpenAI((call) => {
        if (call.system.includes("CHỌN và XẾP THỨ TỰ")) return { keep: [3, 1, 2, 4, 5, 6, 7] };
        const first = Number(/\[(\d+)\]/.exec(call.user)?.[1] ?? 1);
        return { items: [cand(`Ý từ đoạn ${first}`, [first]), cand(`Ý thứ hai từ đoạn ${first}`, [first])] };
      }, calls),
    );
    expect(plan.parts).toBeGreaterThan(1);
    expect(calls).toHaveLength(plan.parts + 1);
    // Chữ ở cuối tài liệu thật sự đã được gửi cho mô hình.
    expect(calls.some((c) => c.user.includes("CHỈ-CÓ-Ở-CUỐI"))).toBe(true);
    expect(plan.items.length).toBeGreaterThanOrEqual(6);
    expect(plan.items.length).toBeLessThanOrEqual(12);
    // Thứ tự theo lượt gộp: ứng viên số 3 (ý đầu của phần thứ hai) đứng đầu dàn.
    const firstOfPart2 = /\[(\d+)\]/.exec(calls[1]!.user)![1];
    expect(plan.items[0]!.core).toBe(`Ý từ đoạn ${firstOfPart2}`);
    const log = await prisma.aiUsageLog.aggregate({ where: { userId }, _sum: { tokensInput: true, tokensOutput: true } });
    expect((log._sum.tokensInput ?? 0) + (log._sum.tokensOutput ?? 0)).toBe(1200 * (plan.parts + 1));
  });

  it("lượt gộp trả về không dùng được thì gộp dự phòng, vẫn đủ ý", async () => {
    const userId = await makeUser();
    const text = Array.from({ length: 60 }, (_, i) => `Mục ${i + 1}\n\n${SENTENCE.repeat(8)}`).join("\n\n");
    const plan = await generateVanDapPlan(
      userId,
      { materials: [{ title: "Dài", text }], durationMin: 30, language: "en" },
      fakeOpenAI((call) =>
        call.system.includes("CHỌN và XẾP THỨ TỰ")
          ? { keep: [999, "x", 1] }
          : { items: Array.from({ length: 4 }, (_, i) => cand(`Ý ${i}-${Math.random()}`, [1])) },
      ),
    );
    expect(plan.items.length).toBeGreaterThanOrEqual(6);
    expect(plan.items.length).toBeLessThanOrEqual(12);
  });

  it("lỗi mô hình giữa chừng: ném lỗi, không trả dàn nửa vời, lượt đã gọi vẫn tính hạn mức (AC1.5)", async () => {
    const userId = await makeUser();
    const text = Array.from({ length: 60 }, (_, i) => `Mục ${i + 1}\n\n${SENTENCE.repeat(8)}`).join("\n\n");
    await expect(
      generateVanDapPlan(
        userId,
        { materials: [{ title: "Dài", text }], durationMin: 30, language: "vi" },
        fakeOpenAI((_c, n) => (n === 1 ? { items: [cand("Ý 1")] } : new Error("model down"))),
      ),
    ).rejects.toMatchObject({ code: "openai_error" });
    const log = await prisma.aiUsageLog.aggregate({ where: { userId }, _sum: { tokensInput: true } });
    expect(log._sum.tokensInput).toBe(1000);
  });

  it("tài liệu quá ngắn hoặc mô hình không trả ý nào thì báo lỗi rõ", async () => {
    const userId = await makeUser();
    await expect(
      generateVanDapPlan(userId, { materials: [{ title: "x", text: "Quá ngắn." }], durationMin: 15, language: "vi" }, fakeOpenAI(() => ({ items: [] }))),
    ).rejects.toMatchObject({ code: "validation_failed", details: "source_too_short" });
    await expect(
      generateVanDapPlan(userId, { materials: [{ title: "x", text: SHORT_DOC }], durationMin: 15, language: "vi" }, fakeOpenAI(() => ({ items: [] }))),
    ).rejects.toMatchObject({ code: "openai_error", details: "empty_plan" });
  });
});
