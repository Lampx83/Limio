import { z } from "zod";
import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { assertCanEditExam } from "../courses/authz";
import { configSchemaForType } from "./schemas";
import { ExamError } from "./types";

const P0_QUESTION_TYPES = [
  "mcq",
  "multi",
  "true_false_notgiven",
  "gap_fill",
  "short_answer",
  "essay",
  // Đợt 1 (thống nhất nhập câu hỏi Quiz/Bank/Exam) — matching thay
  // matching_heading (chưa từng build); ordering/numerical/drag_drop_fill là
  // loại mới, lấy nguyên cấu trúc đã chạy tốt bên Quiz.
  "matching",
  "ordering",
  "numerical",
  "drag_drop_fill",
] as const;

const questionType = z.enum(P0_QUESTION_TYPES);

const evidenceSpanSchema = z
  .object({
    startOffset: z.number().int().min(0),
    endOffset: z.number().int().min(0),
  })
  .refine((s) => s.endOffset > s.startOffset, {
    message: "endOffset must exceed startOffset",
    path: ["endOffset"],
  });

export const CreateExamQuestionInput = z.object({
  type: questionType,
  prompt: z.string().min(1).max(5_000).trim(),
  /** Per-type payload — validated by configSchemaForType(type) downstream. */
  config: z.unknown(),
  points: z.number().int().min(0).max(1_000).optional(),
  passageId: z.string().uuid().nullable().optional(),
  // Gán câu hỏi vào 1 "khung" (ExamSection) khi đề đã chia nhiều phần — UI
  // gọi đây là "Phần I/II..."; xem ContentManager.tsx. Section phải cùng
  // examId và ở selectionMode="fixed" (section random_from_bank không nhận
  // item thêm tay).
  sectionId: z.string().uuid().nullable().optional(),
  evidenceSpan: evidenceSpanSchema.optional(),
  skillIds: z.array(z.string().uuid()).max(20).optional(),
});

export const UpdateExamQuestionInput = z.object({
  type: questionType.optional(),
  prompt: z.string().min(1).max(5_000).trim().optional(),
  config: z.unknown().optional(),
  points: z.number().int().min(0).max(1_000).optional(),
  passageId: z.string().uuid().nullable().optional(),
  evidenceSpan: evidenceSpanSchema.nullable().optional(),
  skillIds: z.array(z.string().uuid()).max(20).optional(),
});

async function assertExamDraft(examId: string, db: PrismaClient) {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { id: true, courseId: true, createdById: true, status: true, kind: true },
  });
  if (!exam) throw new ExamError("exam_not_found");
  if (exam.status === "archived") throw new ExamError("exam_not_draft");
  // A6.1 — Vấn đáp AI không dùng ExamQuestion; luồng câu hỏi thuộc riêng thi viết.
  if (exam.kind === "oral") throw new ExamError("exam_not_written");
  return exam;
}

async function loadQuestionWithCourse(questionId: string, db: PrismaClient) {
  const q = await db.examQuestion.findUnique({
    where: { id: questionId },
    select: {
      id: true,
      examId: true,
      passageId: true,
      exam: { select: { courseId: true, createdById: true, status: true } },
    },
  });
  if (!q) throw new ExamError("validation_failed", "question_not_found");
  return q;
}

function validateConfigForType(type: string, config: unknown): unknown {
  const schema = configSchemaForType(type);
  const parsed = schema.safeParse(config);
  if (!parsed.success) {
    throw new ExamError("validation_failed", parsed.error.flatten());
  }
  return parsed.data;
}

async function assertPassageInExam(
  passageId: string,
  examId: string,
  db: PrismaClient,
) {
  const p = await db.examPassage.findUnique({
    where: { id: passageId },
    select: { examId: true },
  });
  if (!p) throw new ExamError("passage_not_found");
  if (p.examId !== examId) throw new ExamError("course_mismatch");
}

async function assertSectionInExam(
  sectionId: string,
  examId: string,
  db: PrismaClient,
) {
  const s = await db.examSection.findUnique({
    where: { id: sectionId },
    select: { examId: true, selectionMode: true },
  });
  if (!s) throw new ExamError("section_not_found");
  if (s.examId !== examId) throw new ExamError("course_mismatch");
  // random_from_bank section quản lý item của nó qua poolFilter/assemble —
  // thêm tay vào đây sẽ lệch với materializedQuestionIds.
  if (s.selectionMode !== "fixed")
    throw new ExamError("validation_failed", "section_not_fixed");
}

/** A7.3.1 / A7.3.2 — Create question (passage-bound or standalone). */
export async function createExamQuestion(
  actorUserId: string,
  examId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<{ questionId: string }> {
  const exam = await assertExamDraft(examId, db);
  await assertCanEditExam(actorUserId, exam, db);
  const parsed = CreateExamQuestionInput.safeParse(rawInput);
  if (!parsed.success) throw new ExamError("validation_failed", parsed.error.flatten());
  const d = parsed.data;
  const validConfig = validateConfigForType(d.type, d.config);

  const passageId = d.passageId ?? null;
  if (passageId) {
    await assertPassageInExam(passageId, examId, db);
  }
  const sectionId = d.sectionId ?? null;
  if (sectionId) {
    await assertSectionInExam(sectionId, examId, db);
  }

  const created = await (db as typeof prisma).$transaction(async (tx) => {
    // Append to end — orderInExam global, orderInPassage scoped.
    const orderInExam = await tx.examQuestion.count({ where: { examId } });
    const orderInPassage = passageId
      ? await tx.examQuestion.count({ where: { passageId } })
      : null;
    const points = d.points ?? 1;

    const q = await tx.examQuestion.create({
      data: {
        examId,
        passageId,
        type: d.type,
        prompt: d.prompt,
        config: validConfig as Prisma.InputJsonValue,
        evidenceSpan: d.evidenceSpan
          ? (d.evidenceSpan as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        points,
        orderInExam,
        orderInPassage,
      },
      select: { id: true },
    });

    if (d.skillIds && d.skillIds.length > 0) {
      await tx.examQuestionSkillTag.createMany({
        data: d.skillIds.map((skillId) => ({ questionId: q.id, skillId })),
        skipDuplicates: true,
      });
    }

    if (sectionId) {
      const orderInSection =
        ((
          await tx.examSectionItem.aggregate({
            where: { sectionId },
            _max: { orderInSection: true },
          })
        )._max.orderInSection ?? -1) + 1;
      await tx.examSectionItem.create({
        data: { sectionId, examQuestionId: q.id, orderInSection, points },
      });
    }

    return q;
  });

  return { questionId: created.id };
}

export async function updateExamQuestion(
  actorUserId: string,
  questionId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<void> {
  const q = await loadQuestionWithCourse(questionId, db);
  if (q.exam.status === "archived") throw new ExamError("exam_not_draft");
  await assertCanEditExam(actorUserId, q.exam, db);
  const parsed = UpdateExamQuestionInput.safeParse(rawInput);
  if (!parsed.success) throw new ExamError("validation_failed", parsed.error.flatten());
  const d = parsed.data;

  // If type OR config changes, re-validate config against (new or existing) type.
  let validConfig: unknown | undefined;
  if (d.type !== undefined || d.config !== undefined) {
    const current = await db.examQuestion.findUniqueOrThrow({
      where: { id: questionId },
      select: { type: true, config: true },
    });
    const effectiveType = d.type ?? current.type;
    const effectiveConfig = d.config !== undefined ? d.config : current.config;
    validConfig = validateConfigForType(effectiveType, effectiveConfig);
  }

  // If passageId changes, sanity check it belongs to the same exam.
  if (d.passageId !== undefined && d.passageId !== null) {
    await assertPassageInExam(d.passageId, q.examId, db);
  }

  await (db as typeof prisma).$transaction(async (tx) => {
    const data: Prisma.ExamQuestionUpdateInput = {};
    if (d.type !== undefined) data.type = d.type;
    if (d.prompt !== undefined) data.prompt = d.prompt;
    if (validConfig !== undefined) data.config = validConfig as Prisma.InputJsonValue;
    if (d.points !== undefined) data.points = d.points;
    if (d.passageId !== undefined) {
      data.passage = d.passageId
        ? { connect: { id: d.passageId } }
        : { disconnect: true };
      // Recompute orderInPassage when moving question across passages.
      if (d.passageId === null) {
        data.orderInPassage = null;
      } else {
        const next = await tx.examQuestion.count({
          where: { passageId: d.passageId, NOT: { id: questionId } },
        });
        data.orderInPassage = next;
      }
    }
    if (d.evidenceSpan !== undefined) {
      data.evidenceSpan = d.evidenceSpan
        ? (d.evidenceSpan as Prisma.InputJsonValue)
        : Prisma.JsonNull;
    }
    if (Object.keys(data).length > 0) {
      await tx.examQuestion.update({ where: { id: questionId }, data });
    }
    if (d.skillIds !== undefined) {
      await tx.examQuestionSkillTag.deleteMany({ where: { questionId } });
      if (d.skillIds.length > 0) {
        await tx.examQuestionSkillTag.createMany({
          data: d.skillIds.map((skillId) => ({ questionId, skillId })),
          skipDuplicates: true,
        });
      }
    }
  });
}

export async function deleteExamQuestion(
  actorUserId: string,
  questionId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const q = await loadQuestionWithCourse(questionId, db);
  if (q.exam.status === "archived") throw new ExamError("exam_not_draft");
  await assertCanEditExam(actorUserId, q.exam, db);
  await db.examQuestion.delete({ where: { id: questionId } });
}

/**
 * Reorder questions within a scope.
 *   passageId = string → reorder questions in that passage by orderInPassage
 *   passageId = null   → reorder standalone questions by orderInExam
 *
 * Unlike module reorder, no unique constraint on order columns so a single
 * pass is safe.
 */
export async function reorderExamQuestions(
  actorUserId: string,
  examId: string,
  passageId: string | null,
  orderedQuestionIds: string[],
  db: PrismaClient = prisma,
): Promise<void> {
  const exam = await assertExamDraft(examId, db);
  await assertCanEditExam(actorUserId, exam, db);

  const where = passageId
    ? { examId, passageId }
    : { examId, passageId: null };
  const existing = await db.examQuestion.findMany({
    where,
    select: { id: true },
  });
  const existingIds = new Set(existing.map((q) => q.id));
  const incoming = new Set(orderedQuestionIds);
  for (const id of orderedQuestionIds) {
    if (!existingIds.has(id)) {
      throw new ExamError("validation_failed", `unknown_question:${id}`);
    }
  }
  if (incoming.size !== existingIds.size) {
    throw new ExamError("validation_failed", "must_include_all_questions");
  }
  const field = passageId ? "orderInPassage" : "orderInExam";
  await (db as typeof prisma).$transaction(async (tx) => {
    for (let i = 0; i < orderedQuestionIds.length; i++) {
      await tx.examQuestion.update({
        where: { id: orderedQuestionIds[i]! },
        data: { [field]: i } as Prisma.ExamQuestionUpdateInput,
      });
    }
  });
}
