/**
 * A5.2.4 — Exam sections + random pool sampler (P2 T4-D5+D6).
 *
 * Scope:
 *   - Section CRUD (createSection, listSections, updateSection, deleteSection)
 *   - `pickPoolQuestions(filter, seed)` deterministic sampler with stratified
 *     selection by difficulty when multiple levels are requested.
 *   - `materializeRandomSections(examId, subjectKey, attemptId, db)` — at
 *     attempt start, run the sampler for every per_attempt random section
 *     and return `{sectionId: bankQuestionIds[]}` for storage in shuffleSnapshot.
 *
 * Player-side wiring (rendering bank questions during the attempt) is
 * deferred — out of scope for D5+D6. The sampler output is stored and
 * proven deterministic; full integration arrives with P3 proctoring polish.
 */

import { createHash } from "node:crypto";
import { z } from "zod";
import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { assertCanEditCourse } from "../courses/authz";
import { ExamError } from "./types";

// ============================================================================
// Pool filter schema + sampler
// ============================================================================

export const PoolFilter = z.object({
  /** Bank IDs to sample from. Required — must list ≥1. */
  bankIds: z.array(z.string().uuid()).min(1),
  /** Number of questions to draw. */
  count: z.number().int().min(1).max(200),
  /** Skill filter (OR within array). */
  skillIds: z.array(z.string().uuid()).optional(),
  /** Difficulty filter (OR within array). 1-5. */
  difficulty: z.array(z.number().int().min(1).max(5)).optional(),
  /** Question type filter. */
  type: z.array(z.string()).optional(),
  /** Per-item point override (else inherit from question). */
  pointsPerItem: z.number().int().min(1).max(100).optional(),
});
export type PoolFilterT = z.infer<typeof PoolFilter>;

/**
 * Deterministic xorshift32 RNG seeded from a string. seededShuffle pattern
 * from attempts.ts — same algorithm so seeds compose predictably.
 */
function seededRng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) / 4294967296);
  };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Sample N bank question IDs deterministically from a filtered pool.
 * Stratification: when filter has multiple difficulty levels (e.g. [1,3,5]),
 * split count evenly across them (with remainder going to the first bucket).
 */
export async function pickPoolQuestions(
  filter: PoolFilterT,
  seed: string,
  db: PrismaClient = prisma,
): Promise<string[]> {
  const baseWhere: Prisma.BankQuestionWhereInput = {
    bankId: { in: filter.bankIds },
    status: "published",
    ...(filter.type && filter.type.length > 0
      ? { type: { in: filter.type as never } }
      : {}),
    ...(filter.skillIds && filter.skillIds.length > 0
      ? { skillTags: { some: { skillId: { in: filter.skillIds } } } }
      : {}),
  };

  // Stratified path: multiple difficulties → bucket per level.
  if (filter.difficulty && filter.difficulty.length > 1) {
    const levels = [...new Set(filter.difficulty)].sort();
    const baseQuota = Math.floor(filter.count / levels.length);
    const remainder = filter.count - baseQuota * levels.length;
    const picked: string[] = [];
    for (let i = 0; i < levels.length; i++) {
      const level = levels[i]!;
      const quota = baseQuota + (i < remainder ? 1 : 0);
      if (quota <= 0) continue;
      const ids = await db.bankQuestion.findMany({
        where: { ...baseWhere, difficulty: level },
        select: { id: true },
      });
      const rng = seededRng(`${seed}:diff${level}`);
      const shuffled = shuffle(
        ids.map((q) => q.id),
        rng,
      );
      picked.push(...shuffled.slice(0, quota));
    }
    if (picked.length === 0) throw new ExamError("section_pool_empty");
    if (picked.length < filter.count)
      throw new ExamError("section_pool_underfilled", {
        requested: filter.count,
        got: picked.length,
      });
    return picked;
  }

  // Single-difficulty or no-difficulty path: simple shuffle + slice.
  const where: Prisma.BankQuestionWhereInput =
    filter.difficulty && filter.difficulty.length === 1
      ? { ...baseWhere, difficulty: filter.difficulty[0] }
      : baseWhere;
  const ids = await db.bankQuestion.findMany({
    where,
    select: { id: true },
  });
  if (ids.length === 0) throw new ExamError("section_pool_empty");
  if (ids.length < filter.count)
    throw new ExamError("section_pool_underfilled", {
      requested: filter.count,
      got: ids.length,
    });
  const rng = seededRng(seed);
  return shuffle(
    ids.map((q) => q.id),
    rng,
  ).slice(0, filter.count);
}

// ============================================================================
// Section CRUD (instructor admin)
// ============================================================================

const SelectionMode = z.enum(["fixed", "random_from_bank"]);
const ResolutionMode = z.enum(["per_attempt", "per_publish"]);

export const CreateSectionInput = z.object({
  title: z.string().min(1).max(200).trim(),
  selectionMode: SelectionMode.optional(),
  resolutionMode: ResolutionMode.optional(),
  poolFilter: PoolFilter.optional(),
});

async function assertExamEditable(
  actorUserId: string,
  examId: string,
  db: PrismaClient,
): Promise<{ id: string; courseId: string }> {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { id: true, courseId: true },
  });
  if (!exam) throw new ExamError("exam_not_found");
  await assertCanEditCourse(actorUserId, exam.courseId, db);
  return exam;
}

export async function createSection(
  actorUserId: string,
  examId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<{ id: string }> {
  await assertExamEditable(actorUserId, examId, db);
  const parsed = CreateSectionInput.safeParse(rawInput);
  if (!parsed.success)
    throw new ExamError("validation_failed", parsed.error.flatten());
  const d = parsed.data;
  if (d.selectionMode === "random_from_bank" && !d.poolFilter)
    throw new ExamError("validation_failed", { reason: "poolFilter_required" });
  const max = await db.examSection.aggregate({
    where: { examId },
    _max: { orderIndex: true },
  });
  const nextOrder = (max._max.orderIndex ?? -1) + 1;
  const s = await db.examSection.create({
    data: {
      examId,
      title: d.title,
      orderIndex: nextOrder,
      selectionMode: d.selectionMode ?? "fixed",
      resolutionMode: d.resolutionMode ?? "per_attempt",
      poolFilter: (d.poolFilter ?? undefined) as Prisma.InputJsonValue | undefined,
    },
    select: { id: true },
  });
  return s;
}

export interface SectionListItem {
  id: string;
  title: string;
  orderIndex: number;
  selectionMode: "fixed" | "random_from_bank";
  resolutionMode: "per_attempt" | "per_publish";
  poolFilter: PoolFilterT | null;
  itemCount: number;
}

export async function listSections(
  actorUserId: string,
  examId: string,
  db: PrismaClient = prisma,
): Promise<SectionListItem[]> {
  await assertExamEditable(actorUserId, examId, db);
  const rows = await db.examSection.findMany({
    where: { examId },
    orderBy: { orderIndex: "asc" },
    select: {
      id: true,
      title: true,
      orderIndex: true,
      selectionMode: true,
      resolutionMode: true,
      poolFilter: true,
      _count: { select: { items: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    orderIndex: r.orderIndex,
    selectionMode: r.selectionMode,
    resolutionMode: r.resolutionMode,
    poolFilter: (r.poolFilter ?? null) as PoolFilterT | null,
    itemCount: r._count.items,
  }));
}

export async function updateSection(
  actorUserId: string,
  sectionId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<void> {
  const s = await db.examSection.findUnique({
    where: { id: sectionId },
    select: { id: true, exam: { select: { courseId: true } } },
  });
  if (!s) throw new ExamError("section_not_found");
  await assertCanEditCourse(actorUserId, s.exam.courseId, db);
  const parsed = CreateSectionInput.partial().safeParse(rawInput);
  if (!parsed.success)
    throw new ExamError("validation_failed", parsed.error.flatten());
  const d = parsed.data;
  const data: Record<string, unknown> = {};
  if (d.title !== undefined) data.title = d.title;
  if (d.selectionMode !== undefined) data.selectionMode = d.selectionMode;
  if (d.resolutionMode !== undefined) data.resolutionMode = d.resolutionMode;
  if (d.poolFilter !== undefined)
    data.poolFilter = d.poolFilter as Prisma.InputJsonValue;
  if (Object.keys(data).length === 0) return;
  await db.examSection.update({ where: { id: sectionId }, data });
}

export async function deleteSection(
  actorUserId: string,
  sectionId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const s = await db.examSection.findUnique({
    where: { id: sectionId },
    select: { id: true, orderIndex: true, exam: { select: { courseId: true } } },
  });
  if (!s) throw new ExamError("section_not_found");
  await assertCanEditCourse(actorUserId, s.exam.courseId, db);
  if (s.orderIndex === 0) {
    // Default "Main" section. Allow but warn — UI should confirm.
  }
  await db.examSection.delete({ where: { id: sectionId } });
}

// ============================================================================
// Materializer — called from startExamAttempt / claim flows
// ============================================================================

/**
 * For each random_from_bank section with resolutionMode=per_attempt, run the
 * sampler keyed deterministically by (examId, subjectKey, sectionId) and
 * return the mapping. For per_publish sections, return the snapshotted IDs
 * from `materializedQuestionIds` (must have been resolved at publish time).
 *
 * `subjectKey` should be userId for authenticated, candidateId for candidates.
 */
export async function materializeRandomSections(
  examId: string,
  subjectKey: string,
  db: PrismaClient = prisma,
): Promise<Record<string, string[]>> {
  const sections = await db.examSection.findMany({
    where: { examId, selectionMode: "random_from_bank" },
    select: {
      id: true,
      resolutionMode: true,
      poolFilter: true,
      materializedQuestionIds: true,
    },
  });
  const out: Record<string, string[]> = {};
  for (const s of sections) {
    if (s.resolutionMode === "per_publish") {
      const arr = (s.materializedQuestionIds ?? []) as string[];
      out[s.id] = Array.isArray(arr) ? arr : [];
      continue;
    }
    const filterParsed = PoolFilter.safeParse(s.poolFilter);
    if (!filterParsed.success) continue;
    const seed = createHash("sha256")
      .update(`${examId}:${subjectKey}:${s.id}`)
      .digest("hex");
    out[s.id] = await pickPoolQuestions(filterParsed.data, seed, db);
  }
  return out;
}
