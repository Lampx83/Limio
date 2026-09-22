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
  let created = 0;
  const errors: CommitMcqResult["errors"] = [];

  for (const row of validRows) {
    const p = row.parsed!;
    try {
      // mcq/true_false: options đã có sẵn (letter/label/isCorrect) từ parseOneRow.
      // ordering/matching/fill_in tới từ AI import — options rỗng, dữ liệu thật
      // nằm ở items/pairs/acceptedAnswers, cần dựng lại theo đúng shape Quiz cần
      // (bảng quan hệ QuestionOption, khác hẳn config JSON của Bank/Exam).
      let options: Array<{
        label: string;
        isCorrect: boolean;
        extra?: Record<string, unknown>;
      }>;
      if (p.type === "ordering") {
        // Thứ tự trong mảng = orderIndex lúc tạo = đáp án đúng (xem
        // quizzes/grading.ts case "ordering"). isCorrect không được logic chấm
        // đọc tới, nhưng Zod CreateQuestionInput vẫn yêu cầu options non-empty.
        options = (p.items ?? []).map((it) => ({ label: it.label, isCorrect: true }));
      } else if (p.type === "matching") {
        // Mỗi cặp → 2 option cùng pairKey, khác side — đúng shape mà
        // quizzes/grading.ts case "matching" đọc (extra.side/extra.pairKey).
        options = (p.pairs ?? []).flatMap((pair) => [
          { label: pair.left, isCorrect: true, extra: { side: "left", pairKey: pair.id } },
          { label: pair.right, isCorrect: true, extra: { side: "right", pairKey: pair.id } },
        ]);
      } else if (p.type === "fill_in") {
        options = (p.acceptedAnswers ?? []).map((a) => ({ label: a, isCorrect: true }));
      } else {
        options = p.options.map((o) => ({ label: o.label, isCorrect: o.isCorrect }));
      }

      await createQuestion(
        actorUserId,
        quizId,
        {
          type: p.type,
          prompt: p.prompt,
          explanation: p.explanation ?? undefined,
          points: p.points,
          options,
          skillIds: [],
          // Topic / chủ đề lưu vào QuizQuestion.extra để instructor có thể
          // filter/group sau. extra cũng giữ các field type-specific khác
          // (numerical: expected/tolerance, short_answer: acceptedRegexes),
          // chúng không xung đột với topic.
          extra: p.topic ? { topic: p.topic } : undefined,
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
