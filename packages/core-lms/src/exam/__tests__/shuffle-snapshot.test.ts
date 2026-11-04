import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@feedbackme/db";
import { buildShuffleSnapshot } from "../attempts";

/**
 * Trộn đề cho từng thí sinh: câu độc lập và lựa chọn khác nhau mỗi người, nhưng tự luận
 * luôn ở cuối và hai nút Đúng/Sai không đổi chỗ (dễ bấm nhầm khi đổi giữa các ý).
 */
const mcq = (id: string, passageId: string | null = null, order = 0) => ({
  id,
  type: "mcq",
  passageId,
  orderInPassage: passageId ? order : null,
  config: {
    options: ["a", "b", "c", "d"].map((o) => ({ id: o, label: `Lựa chọn ${o}`, isCorrect: o === "a" })),
  },
});
const essay = (id: string) => ({ id, type: "essay", passageId: null, orderInPassage: null, config: {} });
const trueFalse = (id: string, labels = ["Đúng", "Sai"]) => ({
  id,
  type: "mcq",
  passageId: "p1",
  orderInPassage: 0,
  config: { options: labels.map((label, i) => ({ id: "ab"[i], label, isCorrect: i === 0 })) },
});

function fakeDb(rows: unknown[]) {
  return { examQuestion: { findMany: async () => rows } } as unknown as PrismaClient;
}

const STANDALONE = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8"].map((id) => mcq(id));

describe("buildShuffleSnapshot", () => {
  it("tự luận luôn ở cuối, câu còn lại được trộn khác nhau giữa các thí sinh", async () => {
    const db = fakeDb([essay("e1"), ...STANDALONE, essay("e2")]);
    const orders: string[][] = [];
    for (const attempt of ["a1", "a2", "a3", "a4"]) {
      const snap = await buildShuffleSnapshot("x", attempt, true, false, db);
      const order = snap.questionOrderByPassage.standalone!;
      expect(order.slice(-2)).toEqual(["e1", "e2"]);
      expect([...order.slice(0, -2)].sort()).toEqual(STANDALONE.map((q) => q.id));
      orders.push(order);
    }
    expect(new Set(orders.map((o) => o.join())).size).toBeGreaterThan(1);
  });

  it("cùng một lượt thi tải lại vẫn đúng thứ tự cũ", async () => {
    const db = fakeDb([...STANDALONE, essay("e1")]);
    const a = await buildShuffleSnapshot("x", "a1", true, true, db);
    const b = await buildShuffleSnapshot("x", "a1", true, true, db);
    expect(a).toEqual(b);
  });

  it("tắt xáo câu thì giữ nguyên thứ tự soạn, kể cả tự luận ở giữa", async () => {
    const db = fakeDb([mcq("q1"), essay("e1"), mcq("q2")]);
    const snap = await buildShuffleSnapshot("x", "a1", false, false, db);
    expect(snap.questionOrderByPassage.standalone).toEqual(["q1", "e1", "q2"]);
  });

  it("câu trong đoạn đọc không bị trộn", async () => {
    const db = fakeDb([mcq("q3", "p1", 2), mcq("q1", "p1", 0), mcq("q2", "p1", 1)]);
    const snap = await buildShuffleSnapshot("x", "a1", true, true, db);
    expect(snap.questionOrderByPassage.p1).toEqual(["q1", "q2", "q3"]);
  });

  it("câu nhiều lựa chọn được xáo khác nhau, câu Đúng/Sai giữ nguyên", async () => {
    const rows = [...STANDALONE, trueFalse("tf1"), trueFalse("tf2", ["sai", " ĐÚNG "]), trueFalse("tf3", ["True", "False"])];
    const db = fakeDb(rows);
    const a = await buildShuffleSnapshot("x", "a1", true, true, db);
    const b = await buildShuffleSnapshot("x", "a2", true, true, db);
    for (const id of ["tf1", "tf2", "tf3"]) expect(a.optionOrderByQuestion[id]).toBeUndefined();
    expect([...a.optionOrderByQuestion.q1!].sort()).toEqual(["a", "b", "c", "d"]);
    expect(
      STANDALONE.some((q) => a.optionOrderByQuestion[q.id]!.join() !== b.optionOrderByQuestion[q.id]!.join()),
    ).toBe(true);
  });

  it("câu hai lựa chọn khác vẫn được xáo", async () => {
    const db = fakeDb([trueFalse("c1", ["Có thể", "Không thể"])]);
    const snap = await buildShuffleSnapshot("x", "a1", true, true, db);
    expect(snap.optionOrderByQuestion.c1).toBeDefined();
  });
});
