import { Prisma, prisma, type ExamQuestionType, type PrismaClient } from "@feedbackme/db";
import type { ParsedQuestionRow } from "../exam/import";

export interface CommitExamResult {
  imported: number;
  errors: Array<{ rowNumber: number; message: string }>;
}

/**
 * Ghi hàng loạt `ParsedQuestionRow[]` (đã validate — status !== "error") vào
 * `ExamQuestion`. Trích từ logic vốn nằm thẳng trong
 * `apps/web/.../exams/[id]/questions/import/confirm/route.ts` (Excel) để
 * dùng lại được cho AI import (`aiQuestionsToExamRows`).
 *
 * LƯU Ý: đây KHÔNG phải tách nguyên trạng — route gốc bọc cả batch trong 1
 * `prisma.$transaction` (1 câu lỗi → rollback toàn bộ, request 500). Hàm này
 * cố tình bỏ transaction, ghi được bao nhiêu ghi bấy nhiêu và báo lỗi từng
 * dòng, khớp hành vi `commitMcqRowsToBank`/`commitMcqRowsToQuiz` đã có từ
 * trước — nhất quán hơn giữa 3 nơi commit, và tránh 1 câu AI đọc lỗi (hiếm,
 * vd tham chiếu passageId lạ) chặn mất các câu hợp lệ khác trong cùng đợt.
 */
export async function commitExamQuestionRows(
  actorUserId: string,
  examId: string,
  rows: ParsedQuestionRow[],
  db: PrismaClient = prisma,
): Promise<CommitExamResult> {
  void actorUserId; // Authz do route gọi trước (assertCanEditExam) — hàm này chỉ ghi.
  const validRows = rows.filter((r) => r.status !== "error" && r.parsed);
  const errors: CommitExamResult["errors"] = [];
  let imported = 0;

  let nextExamOrder = await db.examQuestion.count({ where: { examId } });
  const passageOrderCounts = new Map<string, number>();

  for (const row of validRows) {
    const p = row.parsed!;
    try {
      let orderInPassage: number | null = null;
      if (p.passageId) {
        if (!passageOrderCounts.has(p.passageId)) {
          passageOrderCounts.set(
            p.passageId,
            await db.examQuestion.count({ where: { examId, passageId: p.passageId } }),
          );
        }
        orderInPassage = passageOrderCounts.get(p.passageId)!;
        passageOrderCounts.set(p.passageId, orderInPassage + 1);
      }
      const q = await db.examQuestion.create({
        data: {
          examId,
          passageId: p.passageId,
          type: p.type as ExamQuestionType,
          prompt: p.prompt,
          config: p.config as Prisma.InputJsonValue,
          points: p.points,
          orderInExam: nextExamOrder++,
          orderInPassage,
        },
        select: { id: true },
      });
      if (p.skillIds.length > 0) {
        await db.examQuestionSkillTag.createMany({
          data: p.skillIds.map((skillId) => ({ questionId: q.id, skillId })),
          skipDuplicates: true,
        });
      }
      imported++;
    } catch (e) {
      errors.push({
        rowNumber: row.rowNumber,
        message: e instanceof Error ? e.message : "unknown_error",
      });
    }
  }

  return { imported, errors };
}
