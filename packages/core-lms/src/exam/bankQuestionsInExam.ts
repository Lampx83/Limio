import { prisma, type PrismaClient } from "@feedbackme/db";

/**
 * Id các câu ngân hàng đã được chép vào đề (qua `ExamQuestionFromBank`). Dùng để
 * không thêm trùng khi giảng viên bốc/chọn câu từ ngân hàng nhiều lần.
 *
 * Câu chép từ ngân hàng là bản sao đóng băng, nên "đã có" nghĩa là đã có một
 * `ExamQuestion` trỏ về `bankQuestionId` đó trong chính đề này.
 */
export async function bankQuestionIdsInExam(
  examId: string,
  db: PrismaClient = prisma,
): Promise<string[]> {
  const rows = await db.examQuestionFromBank.findMany({
    where: { examQuestion: { examId } },
    select: { bankQuestionId: true },
  });
  return [...new Set(rows.map((r) => r.bankQuestionId))];
}
