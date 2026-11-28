/**
 * Bốc câu từ ngân hàng không được lấy lại câu ĐÃ CÓ trong đề: thêm bằng
 * "Chọn nhanh" nhiều lần thì mỗi lần ra câu mới. `excludeIds` loại các câu đó
 * khỏi vòng bốc (ở cả đường theo chủ đề, theo độ khó lẫn đường đơn giản);
 * không truyền thì hành vi như cũ (học viên làm bài, không loại gì).
 */
import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@feedbackme/db";
import { PoolFilter, pickPoolQuestions } from "../sections";

const BANK = "11111111-1111-4111-8111-111111111111";

function fakeDb(sizes: Record<string, number>): PrismaClient {
  const rows: { id: string; topic: string }[] = [];
  for (const [topic, n] of Object.entries(sizes))
    for (let i = 0; i < n; i++) rows.push({ id: `${topic}#${i}`, topic });
  return {
    bankQuestion: {
      findMany: async ({
        where,
      }: {
        where: { config?: { equals?: string }; id?: { notIn?: string[] } };
      }) => {
        const t = where.config?.equals;
        const out = where.id?.notIn ?? [];
        return rows
          .filter((r) => (t === undefined || r.topic === t) && !out.includes(r.id))
          .map((r) => ({ id: r.id }));
      },
    },
  } as unknown as PrismaClient;
}

describe("pickPoolQuestions — excludeIds (câu đã có trong đề)", () => {
  it("đường đơn giản: không bốc lại câu đã có, lần sau ra bộ mới", async () => {
    const db = fakeDb({ A: 30 });
    const filter = PoolFilter.parse({ bankIds: [BANK], count: 10 });
    const first = await pickPoolQuestions(filter, "s1", db, { tolerant: true });
    const second = await pickPoolQuestions(filter, "s2", db, {
      tolerant: true,
      excludeIds: first,
    });
    expect(second).toHaveLength(10);
    expect(second.filter((id) => first.includes(id))).toEqual([]);
  });

  it("đường theo chủ đề: loại câu đã có và bù bằng câu còn lại của chủ đề khác", async () => {
    const db = fakeDb({ "Bài 1": 8, "Bài 6": 20 });
    const filter = PoolFilter.parse({
      bankIds: [BANK],
      count: 10,
      buckets: [
        { topic: "Bài 1", count: 5 },
        { topic: "Bài 6", count: 5 },
      ],
      spillShortfall: true,
    });
    // Đề đã có 6 trong 8 câu của Bài 1 → còn 2 câu Bài 1, phần thiếu bù từ Bài 6.
    const have = Array.from({ length: 6 }, (_, i) => `Bài 1#${i}`);
    const ids = await pickPoolQuestions(filter, "s", db, { tolerant: true, excludeIds: have });
    expect(ids).toHaveLength(10);
    expect(ids.filter((id) => have.includes(id))).toEqual([]);
    expect(ids.filter((id) => id.startsWith("Bài 1")).length).toBe(2);
  });

  it("ngân hàng chỉ còn ít câu chưa dùng: trả đúng số còn lại, không trùng", async () => {
    const db = fakeDb({ A: 12 });
    const filter = PoolFilter.parse({ bankIds: [BANK], count: 10 });
    const have = Array.from({ length: 9 }, (_, i) => `A#${i}`);
    const ids = await pickPoolQuestions(filter, "s", db, { tolerant: true, excludeIds: have });
    expect(ids.sort()).toEqual(["A#10", "A#11", "A#9"]);
  });

  it("không truyền excludeIds: như cũ (không loại gì)", async () => {
    const db = fakeDb({ A: 5 });
    const filter = PoolFilter.parse({ bankIds: [BANK], count: 5 });
    await expect(pickPoolQuestions(filter, "s", db)).resolves.toHaveLength(5);
  });
});
