/**
 * `searchQuestions({ excludeIds })`: màn "Chọn thủ công" ẩn câu đã có trong đề.
 * Phải loại ở truy vấn (không lọc sau trên 30 câu đầu) để tổng số, phân trang
 * và "tải thêm" đều tính trên phần câu chưa dùng.
 */
import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@feedbackme/db";
import { searchQuestions } from "../bank";

function fakeDb() {
  const wheres: unknown[] = [];
  const db = {
    courseInstructor: { findMany: async () => [] },
    questionBank: { findMany: async () => [{ id: "bank-1" }] },
    bankQuestion: {
      findMany: async ({ where }: { where: unknown }) => {
        wheres.push(where);
        return [];
      },
      count: async ({ where }: { where: unknown }) => {
        wheres.push(where);
        return 0;
      },
    },
  } as unknown as PrismaClient;
  return { db, wheres };
}

describe("searchQuestions — excludeIds", () => {
  it("đưa id đã có vào điều kiện notIn của truy vấn và của bộ đếm", async () => {
    const { db, wheres } = fakeDb();
    await searchQuestions("u1", { bankIds: ["bank-1"], excludeIds: ["a", "b"] }, db);
    expect(wheres.length).toBeGreaterThanOrEqual(2);
    for (const w of wheres.slice(0, 1)) {
      expect((w as { id?: unknown }).id).toEqual({ notIn: ["a", "b"] });
    }
  });

  it("không truyền excludeIds thì không thêm điều kiện id", async () => {
    const { db, wheres } = fakeDb();
    await searchQuestions("u1", { bankIds: ["bank-1"] }, db);
    expect((wheres[0] as { id?: unknown }).id).toBeUndefined();
  });
});
