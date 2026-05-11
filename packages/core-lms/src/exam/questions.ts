import { z } from "zod";
import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { assertCanEditCourse } from "../courses/authz";
import { configSchemaForType } from "./schemas";
import { ExamError } from "./types";

const P0_QUESTION_TYPES = [
  "mcq",
  "multi",
  "true_false_notgiven",
  "gap_fill",
  "short_answer",
  "essay",
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
    select: { id: true, courseId: true, status: true },
  });
  if (!exam) throw new ExamError("exam_not_found");
  if (exam.status !== "draft") throw new ExamError("exam_not_draft");
  return exam;
}

async function loadQuestionWithCourse(questionId: string, db: PrismaClient) {
  const q = await db.examQuestion.findUnique({
    where: { id: questionId },
    select: {
      id: true,
      examId: true,
      passageId: true,
      exam: { select: { courseId: true, status: true } },
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

/** A7.3.1 / A7.3.2 — Create question (passage-bound or standalone). */
export async function createExamQuestion(
  actorUserId: string,
  examId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<{ questionId: string }> {
  const exam = await assertExamDraft(examId, db);
  await assertCanEditCourse(actorUserId, exam.courseId, db);
  const parsed = CreateExamQuestionInput.safeParse(rawInput);
  if (!parsed.success) throw new ExamError("validation_failed", parsed.error.flatten());
  const d = parsed.data;
  const validConfig = validateConfigForType(d.type, d.config);

  const passageId = d.passageId ?? null;
  if (passageId) {
    await assertPassageInExam(passageId, examId, db);
  }

  const created = await (db as typeof prisma).$transaction(async (tx) => {
    // Append to end — orderInExam global, orderInPassage scoped.
    const orderInExam = await tx.examQuestion.count({ where: { examId } });
    const orderInPassage = passageId
      ? await tx.examQuestion.count({ where: { passageId } })
      : null;

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
        points: d.points ?? 1,
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
  if (q.exam.status !== "draft") throw new ExamError("exam_not_draft");
  await assertCanEditCourse(actorUserId, q.exam.courseId, db);
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
  if (q.exam.status !== "draft") throw new ExamError("exam_not_draft");
  await assertCanEditCourse(actorUserId, q.exam.courseId, db);
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
  await assertCanEditCourse(actorUserId, exam.courseId, db);

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
