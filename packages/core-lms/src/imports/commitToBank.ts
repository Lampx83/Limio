import { prisma, type PrismaClient } from "@feedbackme/db";
import { createBankQuestion } from "../exam/bank";
import type { ParsedMcqRow } from "./mcqTemplate";

export interface CommitMcqBankResult {
  created: number;
  errors: Array<{ rowNumber: number; message: string }>;
}

/**
 * Bulk-create BankQuestion rows from parsed MCQ template.
 *
 * Type mapping: BankQuestion uses ExamQuestionType enum (mcq/multi/etc),
 * different from QuizQuestion's QuestionType. For our MCQ template:
 *   - mcq with 1 correct  → `mcq`
 *   - mcq with >1 correct → `multi`
 *   - true_false          → `true_false_notgiven` (closest exam-side equivalent,
 *                            still binary True/False — instructor edits later
 *                            if "not_given" branch needed).
 *
 * Config shape mirrors what BankQuestion expects (config.options[] for mcq/multi,
 * config.correct for tf). See packages/core-lms/src/exam/schemas.ts for canonical
 * shapes.
 */
export async function commitMcqRowsToBank(
  actorUserId: string,
  bankId: string,
  rows: ParsedMcqRow[],
  db: PrismaClient = prisma,
): Promise<CommitMcqBankResult> {
  const validRows = rows.filter((r) => r.status !== "error" && r.parsed);
  let created = 0;
  const errors: CommitMcqBankResult["errors"] = [];

  for (const row of validRows) {
    const p = row.parsed!;
    try {
      const correctCount = p.options.filter((o) => o.isCorrect).length;
      let bankType: "mcq" | "multi" | "true_false_notgiven";
      let config: Record<string, unknown>;
      if (p.type === "true_false") {
        bankType = "true_false_notgiven";
        // true_false template stores Đúng=A, Sai=B. Map to exam's
        // true/false/not_given values: A correct → "true", B correct → "false".
        const correctLetter = p.options.find((o) => o.isCorrect)?.letter;
        config = { correct: correctLetter === "A" ? "true" : "false" };
      } else {
        bankType = correctCount > 1 ? "multi" : "mcq";
        config = {
          options: p.options.map((o, i) => ({
            id: `opt-${i}-${Math.random().toString(36).slice(2, 8)}`,
            label: o.label,
            isCorrect: o.isCorrect,
          })),
        };
      }
      // Topic stored in config.topic — BankQuestion không có dedicated topic
      // field. Free-text, không validate. UI filter có thể đọc config.topic.
      if (p.topic) config.topic = p.topic;

      await createBankQuestion(
        actorUserId,
        bankId,
        {
          type: bankType,
          prompt: p.prompt,
          config,
          points: p.points,
          difficulty: p.difficulty,
          cognitiveLevel: p.cognitiveLevel,
        },
        db,
      );
      created++;
    } catch (e) {
      errors.push({
        rowNumber: row.rowNumber,
        message: e instanceof Error ? e.message : "unknown_error",
      });
    }
  }

  return { created, errors };
}
