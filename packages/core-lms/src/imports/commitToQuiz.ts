import { prisma, type PrismaClient } from "@feedbackme/db";
import { createQuestion } from "../quizzes/questions";
import type { ParsedMcqRow } from "./mcqTemplate";

export interface CommitMcqResult {
  created: number;
  errors: Array<{ rowNumber: number; message: string }>;
}

/**
 * Bulk-create QuizQuestion rows from parsed MCQ template. One question per row.
 * Skips rows with status=error (caller should reject those at preview anyway).
 * Continues on per-row create failure — returns partial success + per-row error.
 *
 * Auth: createQuestion does its own assertQuizEditAuth per call, so passing
 * the same actorUserId is sufficient.
 *
 * Ordering: each new question gets orderIndex = current max + 1 + N. Read max
 * once at start; race with concurrent inserts is acceptable (rare for instructor
 * import flow, and DB has no unique constraint on (quizId, orderIndex)).
 */
export async function commitMcqRowsToQuiz(
  actorUserId: string,
  quizId: string,
  rows: ParsedMcqRow[],
  db: PrismaClient = prisma,
): Promise<CommitMcqResult> {
  const validRows = rows.filter((r) => r.status !== "error" && r.parsed);
  const maxRow = await db.quizQuestion.findFirst({
    where: { quizId },
    orderBy: { orderIndex: "desc" },
    select: { orderIndex: true },
  });
  let nextIdx = (maxRow?.orderIndex ?? -1) + 1;

  let created = 0;
  const errors: CommitMcqResult["errors"] = [];

  for (const row of validRows) {
    const p = row.parsed!;
    try {
      await createQuestion(
        actorUserId,
        quizId,
        {
          type: p.type,
          prompt: p.prompt,
          explanation: p.explanation ?? undefined,
          points: p.points,
          orderIndex: nextIdx,
          options: p.options.map((o) => ({
            label: o.label,
            isCorrect: o.isCorrect,
          })),
          skillIds: [],
        },
        db,
      );
      created++;
      nextIdx++;
    } catch (e) {
      errors.push({
        rowNumber: row.rowNumber,
        message: e instanceof Error ? e.message : "unknown_error",
      });
    }
  }

  return { created, errors };
}
