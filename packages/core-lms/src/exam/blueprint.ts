/**
 * S4 — Blueprint Editor (Table of Specifications)
 *
 * A blueprint is an explicit mapping from (cognitiveLevel × difficulty) cells
 * to question counts, scoped to a selected set of lessons.
 *
 * Unlike the wizard (which derives bucket weights from a BloomMix +
 * DifficultyProfile), a blueprint lets the instructor specify cell counts
 * directly. assembleFromBlueprint() converts this into a bucketed poolFilter
 * on a single ExamSection (random_from_bank, per_attempt).
 *
 * Authz: actor must be able to edit the exam's course.
 */

import { z } from "zod";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { assertCanEditCourse } from "../courses/authz";
import { ExamError } from "./types";
import { resolveSkillScope, resolveBankScope } from "./wizard";

// ============================================================================
// Types
// ============================================================================

export const BlueprintCellSchema = z.object({
  cognitiveLevel: z.enum(["remember_understand", "apply", "analyze_plus"]),
  difficulty: z.number().int().min(1).max(5),
  count: z.number().int().min(1).max(500),
});
export type BlueprintCell = z.infer<typeof BlueprintCellSchema>;

export const UpsertBlueprintInput = z.object({
  lessonIds: z.array(z.string().uuid()).min(1, "Chọn ít nhất 1 bài học"),
  cells: z.array(BlueprintCellSchema),
});
export type UpsertBlueprintT = z.infer<typeof UpsertBlueprintInput>;

export interface BlueprintData {
  examId: string;
  lessonIds: string[];
  cells: BlueprintCell[];
  totalCount: number;
}

// ============================================================================
// CRUD
// ============================================================================

export async function getBlueprint(
  actorUserId: string,
  examId: string,
  db: PrismaClient = prisma,
): Promise<BlueprintData | null> {
  const exam = await db.exam.findUnique({ where: { id: examId }, select: { courseId: true } });
  if (!exam) throw new ExamError("exam_not_found");
  await assertCanEditCourse(actorUserId, exam.courseId, db);
  const bp = await db.examBlueprint.findUnique({ where: { examId } });
  if (!bp) return null;
  return {
    examId: bp.examId,
    lessonIds: bp.lessonIds,
    cells: bp.cells as BlueprintCell[],
    totalCount: bp.totalCount,
  };
}

export async function upsertBlueprint(
  actorUserId: string,
  examId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<BlueprintData> {
  const exam = await db.exam.findUnique({ where: { id: examId }, select: { courseId: true } });
  if (!exam) throw new ExamError("exam_not_found");
  await assertCanEditCourse(actorUserId, exam.courseId, db);

  const parsed = UpsertBlueprintInput.safeParse(rawInput);
  if (!parsed.success) throw new ExamError("validation_failed", parsed.error.flatten());

  const { lessonIds, cells } = parsed.data;
  const activeCells = cells.filter((c) => c.count > 0);
  const totalCount = activeCells.reduce((s, c) => s + c.count, 0);

  const bp = await db.examBlueprint.upsert({
    where: { examId },
    create: {
      examId,
      lessonIds,
      cells: activeCells as never,
      totalCount,
    },
    update: {
      lessonIds,
      cells: activeCells as never,
      totalCount,
    },
  });

  return {
    examId: bp.examId,
    lessonIds: bp.lessonIds,
    cells: bp.cells as BlueprintCell[],
    totalCount: bp.totalCount,
  };
}

// ============================================================================
// Preview availability per cell
// ============================================================================

export interface BlueprintCellAvailability extends BlueprintCell {
  available: number;
  deficit: number;
}

export interface BlueprintPreviewResult {
  totalRequested: number;
  totalAvailable: number;
  bankIds: string[];
  skillIds: string[];
  cells: BlueprintCellAvailability[];
  deficits: BlueprintCellAvailability[];
  emptyScope: boolean;
}

export async function previewBlueprint(
  actorUserId: string,
  examId: string,
  lessonIds: string[],
  cells: BlueprintCell[],
  db: PrismaClient = prisma,
): Promise<BlueprintPreviewResult> {
  const exam = await db.exam.findUnique({ where: { id: examId }, select: { courseId: true } });
  if (!exam) throw new ExamError("exam_not_found");
  await assertCanEditCourse(actorUserId, exam.courseId, db);

  const activeCells = cells.filter((c) => c.count > 0);
  const totalRequested = activeCells.reduce((s, c) => s + c.count, 0);

  const [skillIds, bankIds] = await Promise.all([
    resolveSkillScope(lessonIds, db),
    resolveBankScope(exam.courseId, actorUserId, db),
  ]);

  const emptyScope = bankIds.length === 0 || skillIds.length === 0;
  if (emptyScope) {
    return {
      totalRequested,
      totalAvailable: 0,
      bankIds,
      skillIds,
      cells: activeCells.map((c) => ({ ...c, available: 0, deficit: c.count })),
      deficits: activeCells.map((c) => ({ ...c, available: 0, deficit: c.count })),
      emptyScope: true,
    };
  }

  const counts = await Promise.all(
    activeCells.map((cell) =>
      db.bankQuestion.count({
        where: {
          bankId: { in: bankIds },
          status: "published",
          cognitiveLevel: cell.cognitiveLevel as never,
          difficulty: cell.difficulty,
          type: { in: ["mcq", "multi", "true_false_notgiven", "gap_fill", "short_answer"] },
          skillTags: { some: { skillId: { in: skillIds } } },
        },
      }),
    ),
  );

  const richCells: BlueprintCellAvailability[] = activeCells.map((c, i) => {
    const available = counts[i] ?? 0;
    return { ...c, available, deficit: Math.max(0, c.count - available) };
  });

  return {
    totalRequested,
    totalAvailable: richCells.reduce((s, c) => s + Math.min(c.count, c.available), 0),
    bankIds,
    skillIds,
    cells: richCells,
    deficits: richCells.filter((c) => c.deficit > 0),
    emptyScope: false,
  };
}

// ============================================================================
// Assemble ExamSection from blueprint
// ============================================================================

export interface AssembleBlueprintResult {
  sectionId: string;
  replaced: boolean;
  totalCount: number;
}

/**
 * Build (or replace) the random-from-bank ExamSection for this exam using
 * the saved blueprint. Creates the section if none exists; replaces the
 * existing random_from_bank section if one is already there (leaving fixed
 * sections untouched). Exam must be in DRAFT status.
 */
export async function assembleExamFromBlueprint(
  actorUserId: string,
  examId: string,
  db: PrismaClient = prisma,
): Promise<AssembleBlueprintResult> {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { courseId: true, status: true },
  });
  if (!exam) throw new ExamError("exam_not_found");
  if (exam.status !== "draft") throw new ExamError("exam_not_draft");
  await assertCanEditCourse(actorUserId, exam.courseId, db);

  const bp = await db.examBlueprint.findUnique({ where: { examId } });
  if (!bp) throw new ExamError("exam_not_found"); // blueprint must exist first

  const cells = bp.cells as BlueprintCell[];
  const activeCells = cells.filter((c) => c.count > 0);
  if (activeCells.length === 0) {
    throw new ExamError("validation_failed", "Blueprint has no cells with count > 0");
  }

  const [skillIds, bankIds] = await Promise.all([
    resolveSkillScope(bp.lessonIds, db),
    resolveBankScope(exam.courseId, actorUserId, db),
  ]);

  const poolFilter = {
    bankIds,
    count: bp.totalCount,
    skillIds: skillIds.length > 0 ? skillIds : undefined,
    buckets: activeCells,
    type: ["mcq", "multi", "true_false_notgiven", "gap_fill", "short_answer"],
  };

  // Find existing random_from_bank section to replace, or create new.
  const existing = await db.examSection.findFirst({
    where: { examId, selectionMode: "random_from_bank" },
    select: { id: true },
  });

  let sectionId: string;
  const replaced = existing !== null;

  if (existing) {
    await db.examSection.update({
      where: { id: existing.id },
      data: {
        poolFilter: poolFilter as never,
        // Re-label so instructor can see it was re-assembled.
        title: "Câu hỏi (Blueprint)",
      },
    });
    sectionId = existing.id;
  } else {
    const created = await db.examSection.create({
      data: {
        examId,
        title: "Câu hỏi (Blueprint)",
        orderIndex: 0,
        selectionMode: "random_from_bank",
        resolutionMode: "per_attempt",
        poolFilter: poolFilter as never,
      },
      select: { id: true },
    });
    sectionId = created.id;
  }

  return { sectionId, replaced, totalCount: bp.totalCount };
}
