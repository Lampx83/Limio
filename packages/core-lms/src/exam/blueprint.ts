/**
 * S4 — Blueprint Editor (Table of Specifications)
 *
 * Two modes:
 *   skill_matrix  — explicit (cognitiveLevel × difficulty) cells scoped to a set
 *                   of lessons (mapped to skillIds via ContentSkillMapping).
 *   topic_only    — per-topic cells with optional Bloom/difficulty narrowing,
 *                   auto-scoped to all banks the actor can edit in the course.
 *
 * assembleExamFromBlueprint() converts the saved blueprint into a bucketed
 * poolFilter on a single ExamSection (random_from_bank, per_attempt).
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

export const BlueprintModeSchema = z.enum(["skill_matrix", "topic_only"]);
export type BlueprintMode = z.infer<typeof BlueprintModeSchema>;

/** skill_matrix cell: BLT × độ khó (existing shape). */
export const SkillMatrixCellSchema = z.object({
  cognitiveLevel: z.enum(["remember_understand", "apply", "analyze_plus"]),
  difficulty: z.number().int().min(1).max(5),
  count: z.number().int().min(1).max(500),
});
export type SkillMatrixCell = z.infer<typeof SkillMatrixCellSchema>;

/** topic_only cell: topic bắt buộc; BLT/độ khó tùy chọn để ràng buộc thêm. */
export const TopicCellSchema = z.object({
  topic: z.string().min(1).max(120),
  cognitiveLevel: z
    .enum(["remember_understand", "apply", "analyze_plus"])
    .optional(),
  difficulty: z.number().int().min(1).max(5).optional(),
  count: z.number().int().min(1).max(500),
});
export type TopicCell = z.infer<typeof TopicCellSchema>;

/** Legacy alias kept for callers that imported `BlueprintCell`. */
export type BlueprintCell = SkillMatrixCell;

export const UpsertBlueprintInput = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("skill_matrix"),
    lessonIds: z.array(z.string().uuid()).min(1, "Chọn ít nhất 1 bài học"),
    cells: z.array(SkillMatrixCellSchema),
  }),
  z.object({
    mode: z.literal("topic_only"),
    // Reserved for future explicit bank-pick; auto-resolved when empty.
    bankIds: z.array(z.string().uuid()).optional().default([]),
    cells: z.array(TopicCellSchema),
  }),
]);
export type UpsertBlueprintT = z.infer<typeof UpsertBlueprintInput>;

export interface BlueprintData {
  examId: string;
  mode: BlueprintMode;
  lessonIds: string[];
  bankIds: string[];
  cells: SkillMatrixCell[] | TopicCell[];
  totalCount: number;
}

// ============================================================================
// CRUD
// ============================================================================

function readMode(raw: unknown): BlueprintMode {
  return raw === "topic_only" ? "topic_only" : "skill_matrix";
}

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
    mode: readMode((bp as { mode?: unknown }).mode),
    lessonIds: bp.lessonIds,
    bankIds: (bp as { bankIds?: string[] }).bankIds ?? [],
    cells: bp.cells as SkillMatrixCell[] | TopicCell[],
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

  const data = parsed.data;
  const activeCells = data.cells.filter((c) => c.count > 0);
  const totalCount = activeCells.reduce((s, c) => s + c.count, 0);
  const lessonIds = data.mode === "skill_matrix" ? data.lessonIds : [];
  const bankIds = data.mode === "topic_only" ? (data.bankIds ?? []) : [];

  const bp = await db.examBlueprint.upsert({
    where: { examId },
    create: {
      examId,
      mode: data.mode,
      lessonIds,
      bankIds,
      cells: activeCells as never,
      totalCount,
    },
    update: {
      mode: data.mode,
      lessonIds,
      bankIds,
      cells: activeCells as never,
      totalCount,
    },
  });

  return {
    examId: bp.examId,
    mode: readMode((bp as { mode?: unknown }).mode),
    lessonIds: bp.lessonIds,
    bankIds: (bp as { bankIds?: string[] }).bankIds ?? [],
    cells: bp.cells as SkillMatrixCell[] | TopicCell[],
    totalCount: bp.totalCount,
  };
}

// ============================================================================
// Preview availability per cell
// ============================================================================

export interface SkillMatrixCellAvailability extends SkillMatrixCell {
  available: number;
  deficit: number;
}
export interface TopicCellAvailability extends TopicCell {
  available: number;
  deficit: number;
}

export interface BlueprintPreviewResult {
  totalRequested: number;
  totalAvailable: number;
  bankIds: string[];
  skillIds: string[];
  cells: (SkillMatrixCellAvailability | TopicCellAvailability)[];
  deficits: (SkillMatrixCellAvailability | TopicCellAvailability)[];
  emptyScope: boolean;
}

const ALLOWED_TYPES = [
  "mcq",
  "multi",
  "true_false_notgiven",
  "gap_fill",
  "short_answer",
] as const;

/**
 * Preview entry-point for `skill_matrix` mode. Kept for backwards compat —
 * callers in topic mode should use `previewBlueprintTopicOnly()` instead.
 */
export async function previewBlueprint(
  actorUserId: string,
  examId: string,
  lessonIds: string[],
  cells: SkillMatrixCell[],
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
          type: { in: ALLOWED_TYPES as never },
          skillTags: { some: { skillId: { in: skillIds } } },
        },
      }),
    ),
  );

  const richCells: SkillMatrixCellAvailability[] = activeCells.map((c, i) => {
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

/** Preview for `topic_only` mode: count per (topic [× BLT × difficulty]) cell. */
export async function previewBlueprintTopicOnly(
  actorUserId: string,
  examId: string,
  cells: TopicCell[],
  db: PrismaClient = prisma,
): Promise<BlueprintPreviewResult> {
  const exam = await db.exam.findUnique({ where: { id: examId }, select: { courseId: true } });
  if (!exam) throw new ExamError("exam_not_found");
  await assertCanEditCourse(actorUserId, exam.courseId, db);

  const activeCells = cells.filter((c) => c.count > 0);
  const totalRequested = activeCells.reduce((s, c) => s + c.count, 0);

  const bankIds = await resolveBankScope(exam.courseId, actorUserId, db);

  if (bankIds.length === 0) {
    return {
      totalRequested,
      totalAvailable: 0,
      bankIds,
      skillIds: [],
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
          type: { in: ALLOWED_TYPES as never },
          config: { path: ["topic"], equals: cell.topic },
          ...(cell.cognitiveLevel !== undefined
            ? { cognitiveLevel: cell.cognitiveLevel as never }
            : {}),
          ...(cell.difficulty !== undefined ? { difficulty: cell.difficulty } : {}),
        },
      }),
    ),
  );

  const richCells: TopicCellAvailability[] = activeCells.map((c, i) => {
    const available = counts[i] ?? 0;
    return { ...c, available, deficit: Math.max(0, c.count - available) };
  });

  return {
    totalRequested,
    totalAvailable: richCells.reduce((s, c) => s + Math.min(c.count, c.available), 0),
    bankIds,
    skillIds: [],
    cells: richCells,
    deficits: richCells.filter((c) => c.deficit > 0),
    emptyScope: false,
  };
}

// ============================================================================
// Topic discovery — list distinct topics in actor's bank scope for an exam
// ============================================================================

export async function listTopicsInExamScope(
  actorUserId: string,
  examId: string,
  db: PrismaClient = prisma,
): Promise<{ topic: string; count: number; publishedCount: number }[]> {
  const exam = await db.exam.findUnique({ where: { id: examId }, select: { courseId: true } });
  if (!exam) throw new ExamError("exam_not_found");
  await assertCanEditCourse(actorUserId, exam.courseId, db);

  const bankIds = await resolveBankScope(exam.courseId, actorUserId, db);
  if (bankIds.length === 0) return [];

  // Discovery query: include cả draft + published để instructor thấy đủ chủ đề
  // và planning trước. Pool sample (pickPoolQuestions) vẫn published-only nên
  // UI cần show publishedCount tách biệt — instructor biết phải publish bao
  // nhiêu trước khi assemble.
  const rows = await db.bankQuestion.findMany({
    where: {
      bankId: { in: bankIds },
      status: { not: "archived" },
      type: { in: ALLOWED_TYPES as never },
    },
    select: { config: true, status: true },
  });
  const tally = new Map<string, { count: number; publishedCount: number }>();
  for (const r of rows) {
    const cfg = r.config as { topic?: unknown } | null;
    const t = typeof cfg?.topic === "string" ? cfg.topic.trim() : "";
    if (!t) continue;
    const cur = tally.get(t) ?? { count: 0, publishedCount: 0 };
    cur.count += 1;
    if (r.status === "published") cur.publishedCount += 1;
    tally.set(t, cur);
  }
  return [...tally.entries()]
    .map(([topic, v]) => ({ topic, count: v.count, publishedCount: v.publishedCount }))
    .sort((a, b) => a.topic.localeCompare(b.topic, "vi"));
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

  const mode = readMode((bp as { mode?: unknown }).mode);
  const cells = bp.cells as Array<Record<string, unknown> & { count: number }>;
  const activeCells = cells.filter((c) => c.count > 0);
  if (activeCells.length === 0) {
    throw new ExamError("validation_failed", "Blueprint has no cells with count > 0");
  }

  const bankIds = await resolveBankScope(exam.courseId, actorUserId, db);

  // skillIds only relevant for skill_matrix mode. In topic mode we filter by
  // config.topic at the bucket level, so we don't constrain skillIds.
  let skillIds: string[] = [];
  if (mode === "skill_matrix") {
    skillIds = await resolveSkillScope(bp.lessonIds, db);
  }

  const buckets = activeCells.map((c) => {
    const out: Record<string, unknown> = { count: c.count };
    if (typeof c.cognitiveLevel === "string") out.cognitiveLevel = c.cognitiveLevel;
    if (typeof c.difficulty === "number") out.difficulty = c.difficulty;
    if (typeof c.topic === "string") out.topic = c.topic;
    return out;
  });

  const poolFilter = {
    bankIds,
    count: bp.totalCount,
    skillIds: skillIds.length > 0 ? skillIds : undefined,
    buckets,
    type: ALLOWED_TYPES,
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
