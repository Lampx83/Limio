/**
 * "Chọn nhanh theo tiêu chí": chia đều số câu cho từng chủ đề, nhưng một chủ đề
 * nhỏ (vd Bài 14 chỉ có 4 câu) không được làm hụt cả đề khi các chủ đề khác còn
 * dư câu. Cờ `spillShortfall` bù phần thiếu sang chủ đề còn câu; không có cờ
 * (ma trận đề, wizard) thì hạn mức từng ô là cố định như cũ.
 *
 * Dùng db giả (pickPoolQuestions nhận db làm tham số) nên không cần dữ liệu thật.
 */
import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@feedbackme/db";
import { PoolFilter, pickPoolQuestions } from "../sections";

const BANK = "11111111-1111-4111-8111-111111111111";

function fakeDb(sizes: Record<string, number>): { db: PrismaClient; topicOf: Map<string, string> } {
  const rows: { id: string; topic: string }[] = [];
  const topicOf = new Map<string, string>();
  for (const [topic, n] of Object.entries(sizes)) {
    for (let i = 0; i < n; i++) {
      const id = `${topic}#${i}`;
      rows.push({ id, topic });
      topicOf.set(id, topic);
    }
  }
  const db = {
    bankQuestion: {
      findMany: async ({ where }: { where: { config?: { equals?: string } } }) => {
        const t = where.config?.equals;
        return rows.filter((r) => t === undefined || r.topic === t).map((r) => ({ id: r.id }));
      },
    },
  } as unknown as PrismaClient;
  return { db, topicOf };
}

const SIZES = { "Bài 1": 17, "Bài 6": 18, "Bài 14": 4 };
const buckets = [
  { topic: "Bài 1", count: 7 },
  { topic: "Bài 6", count: 7 },
  { topic: "Bài 14", count: 6 },
];

function tally(ids: string[], topicOf: Map<string, string>) {
  const out: Record<string, number> = {};
  for (const id of ids) out[topicOf.get(id)!] = (out[topicOf.get(id)!] ?? 0) + 1;
  return out;
}

describe("pickPoolQuestions — bù câu thiếu giữa các chủ đề", () => {
  it("có cờ: chủ đề nhỏ thiếu thì phần thiếu bù từ chủ đề còn dư, đủ 20 câu", async () => {
    const { db, topicOf } = fakeDb(SIZES);
    const filter = PoolFilter.parse({ bankIds: [BANK], count: 20, buckets, spillShortfall: true });
    const ids = await pickPoolQuestions(filter, "seed", db, { tolerant: true });
    expect(ids).toHaveLength(20);
    expect(new Set(ids).size).toBe(20); // không trùng câu
    const t = tally(ids, topicOf);
    expect(t["Bài 14"]).toBe(4); // lấy hết chủ đề nhỏ
    expect(t["Bài 1"]! + t["Bài 6"]!).toBe(16);
    expect(t["Bài 1"]).toBeGreaterThanOrEqual(7); // không chủ đề nào bị cắt dưới hạn mức
    expect(t["Bài 6"]).toBeGreaterThanOrEqual(7);
  });

  it("có cờ: chạy ở chế độ học viên (không tolerant) không còn ném section_pool_underfilled", async () => {
    const { db } = fakeDb(SIZES);
    const filter = PoolFilter.parse({ bankIds: [BANK], count: 20, buckets, spillShortfall: true });
    await expect(pickPoolQuestions(filter, "seed", db)).resolves.toHaveLength(20);
  });

  it("không cờ: giữ hạn mức từng ô, vẫn thiếu như cũ (ma trận đề/wizard)", async () => {
    const { db } = fakeDb(SIZES);
    const filter = PoolFilter.parse({ bankIds: [BANK], count: 20, buckets });
    const ids = await pickPoolQuestions(filter, "seed", db, { tolerant: true });
    expect(ids).toHaveLength(18);
    await expect(pickPoolQuestions(filter, "seed", db)).rejects.toMatchObject({
      code: "section_pool_underfilled",
    });
  });

  it("có cờ nhưng cả ngân hàng không đủ: trả hết những gì có, không vòng lặp vô hạn", async () => {
    const { db } = fakeDb({ "Bài 1": 5, "Bài 6": 4, "Bài 14": 3 });
    const filter = PoolFilter.parse({ bankIds: [BANK], count: 20, buckets, spillShortfall: true });
    const ids = await pickPoolQuestions(filter, "seed", db, { tolerant: true });
    expect(ids).toHaveLength(12);
    expect(new Set(ids).size).toBe(12);
  });

  it("có cờ: cùng seed cho cùng kết quả (xem trước = lúc chốt)", async () => {
    const { db } = fakeDb(SIZES);
    const filter = PoolFilter.parse({ bankIds: [BANK], count: 20, buckets, spillShortfall: true });
    const a = await pickPoolQuestions(filter, "s1", db, { tolerant: true });
    const b = await pickPoolQuestions(filter, "s1", db, { tolerant: true });
    const c = await pickPoolQuestions(filter, "s2", db, { tolerant: true });
    expect(a).toEqual(b);
    expect(c).not.toEqual(a);
  });

  it("có cờ: nhiều chủ đề nhỏ cùng thiếu, phần bù chia đều cho chủ đề còn dư", async () => {
    // 20 câu / 4 chủ đề = 5 mỗi chủ đề; 2 chủ đề chỉ có 1 câu → thiếu 8 → dồn sang 2 chủ đề lớn.
    const { db, topicOf } = fakeDb({ A: 1, B: 1, C: 30, D: 30 });
    const filter = PoolFilter.parse({
      bankIds: [BANK],
      count: 20,
      spillShortfall: true,
      buckets: ["A", "B", "C", "D"].map((topic) => ({ topic, count: 5 })),
    });
    const ids = await pickPoolQuestions(filter, "seed", db, { tolerant: true });
    const t = tally(ids, topicOf);
    expect(ids).toHaveLength(20);
    expect(t).toMatchObject({ A: 1, B: 1, C: 9, D: 9 });
  });
});
