/**
 * `bankQuestionIdsInExam`: tập câu ngân hàng đã chép vào một đề (để không thêm
 * trùng và để UI đánh dấu "Đã có trong đề"). Mỗi câu ngân hàng chỉ tính một lần
 * dù có nhiều bản chép.
 */
import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@feedbackme/db";
import { bankQuestionIdsInExam } from "../bankQuestionsInExam";

describe("bankQuestionIdsInExam", () => {
  it("lọc theo đề và gộp id trùng", async () => {
    let seenWhere: unknown;
    const db = {
      examQuestionFromBank: {
        findMany: async ({ where }: { where: unknown }) => {
          seenWhere = where;
          return [{ bankQuestionId: "q1" }, { bankQuestionId: "q2" }, { bankQuestionId: "q1" }];
        },
      },
    } as unknown as PrismaClient;
    const ids = await bankQuestionIdsInExam("exam-1", db);
    expect(seenWhere).toEqual({ examQuestion: { examId: "exam-1" } });
    expect(ids.sort()).toEqual(["q1", "q2"]);
  });

  it("đề chưa có câu nào từ ngân hàng → mảng rỗng", async () => {
    const db = {
      examQuestionFromBank: { findMany: async () => [] },
    } as unknown as PrismaClient;
    await expect(bankQuestionIdsInExam("exam-2", db)).resolves.toEqual([]);
  });
});
