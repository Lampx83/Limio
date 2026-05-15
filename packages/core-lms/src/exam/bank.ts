/**
 * A5.1 — Question Bank services (P1 T3b-D2).
 *
 * Surface:
 *   - createBank        — instructor opens a new bank (private or course-scoped)
 *   - listBanks         — banks visible to actor (owned + course-shared as instructor)
 *   - createBankQuestion— add a draft question to a bank
 *   - updateBankQuestion— edit; auto-snapshot to BankQuestionVersion when the
 *                         question is currently `published` (immutable history)
 *   - publishBankQuestion / archiveBankQuestion — status transitions
 *
 * Invariants enforced:
 *   - Publish requires ≥ 1 skill tag (CLAUDE.md §4.4)
 *   - Edits to a published question snapshot the pre-edit state into a
 *     BankQuestionVersion row, then bump the live row. ExamQuestionFromBank
 *     rows still point to the older versionId, so existing exams stay frozen.
 *   - Archive forbids further edits (must un-archive first or clone)
 */

import { z } from "zod";
import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { assertCanEditCourse, canEditCourse } from "../courses/authz";
import { ExamError } from "./types";

const BankVisibility = z.enum(["private", "course", "org"]);
const QuestionType = z.enum([
  "mcq",
  "multi",
  "true_false_notgiven",
  "gap_fill",
  "short_answer",
  "essay",
  "matching_heading",
]);

export const CreateBankInput = z.object({
  name: z.string().min(1).max(200).trim(),
  description: z.string().max(5_000).optional(),
  courseId: z.string().uuid().optional(),
  visibility: BankVisibility.optional(),
});

export async function createBank(
  actorUserId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<{ id: string }> {
  const parsed = CreateBankInput.safeParse(rawInput);
  if (!parsed.success)
    throw new ExamError("validation_failed", parsed.error.flatten());
  const d = parsed.data;
  // If course-scoped, actor must be an instructor of that course.
  if (d.courseId) await assertCanEditCourse(actorUserId, d.courseId, db);
  const visibility = d.visibility ?? (d.courseId ? "course" : "private");
  const bank = await db.questionBank.create({
    data: {
      ownerUserId: actorUserId,
      courseId: d.courseId ?? null,
      name: d.name,
      description: d.description ?? null,
      visibility,
    },
    select: { id: true },
  });
  return { id: bank.id };
}

export interface BankListItem {
  id: string;
  name: string;
  description: string | null;
  visibility: "private" | "course" | "org";
  courseId: string | null;
  courseTitle: string | null;
  isOwner: boolean;
  questionCount: number;
  updatedAt: string;
}

/**
 * Visible banks for an actor:
 *   - All banks they own (any visibility).
 *   - course-visibility banks where they're an instructor of the course.
 */
export async function listBanks(
  actorUserId: string,
  db: PrismaClient = prisma,
): Promise<BankListItem[]> {
  // Course IDs the actor can edit (instructor or admin).
  const ci = await db.courseInstructor.findMany({
    where: { userId: actorUserId },
    select: { courseId: true },
  });
  const courseIds = ci.map((r) => r.courseId);

  const rows = await db.questionBank.findMany({
    where: {
      OR: [
        { ownerUserId: actorUserId },
        ...(courseIds.length > 0
          ? [{ visibility: "course" as const, courseId: { in: courseIds } }]
          : []),
      ],
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      visibility: true,
      courseId: true,
      ownerUserId: true,
      updatedAt: true,
      course: { select: { title: true } },
      _count: { select: { questions: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    visibility: r.visibility,
    courseId: r.courseId,
    courseTitle: r.course?.title ?? null,
    isOwner: r.ownerUserId === actorUserId,
    questionCount: r._count.questions,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

async function assertCanEditBank(
  actorUserId: string,
  bankId: string,
  db: PrismaClient,
): Promise<{ id: string; courseId: string | null; ownerUserId: string }> {
  const bank = await db.questionBank.findUnique({
    where: { id: bankId },
    select: { id: true, courseId: true, ownerUserId: true, visibility: true },
  });
  if (!bank) throw new ExamError("bank_not_found");
  if (bank.ownerUserId === actorUserId) return bank;
  // course-shared bank → instructor of course can edit
  if (bank.visibility === "course" && bank.courseId) {
    const ok = await canEditCourse(actorUserId, bank.courseId, db);
    if (ok) return bank;
  }
  throw new ExamError("bank_not_found"); // hide existence
}

const CognitiveLevelEnum = z.enum(["remember_understand", "apply", "analyze_plus"]);

export const CreateBankQuestionInput = z.object({
  type: QuestionType,
  prompt: z.string().min(1).max(10_000),
  config: z.record(z.unknown()),
  points: z.number().int().min(1).max(100).optional(),
  difficulty: z.number().int().min(1).max(5).optional(),
  estimatedTimeSec: z.number().int().min(1).max(3600).optional(),
  cognitiveLevel: CognitiveLevelEnum.optional(),
});

export async function createBankQuestion(
  actorUserId: string,
  bankId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<{ id: string }> {
  await assertCanEditBank(actorUserId, bankId, db);
  const parsed = CreateBankQuestionInput.safeParse(rawInput);
  if (!parsed.success)
    throw new ExamError("validation_failed", parsed.error.flatten());
  const d = parsed.data;
  const q = await db.bankQuestion.create({
    data: {
      bankId,
      type: d.type,
      prompt: d.prompt,
      config: d.config as Prisma.InputJsonValue,
      points: d.points ?? 1,
      difficulty: d.difficulty ?? 3,
      cognitiveLevel: d.cognitiveLevel ?? "remember_understand",
      estimatedTimeSec: d.estimatedTimeSec ?? null,
      status: "draft",
    },
    select: { id: true },
  });
  return { id: q.id };
}

async function loadBankQuestion(
  questionId: string,
  db: PrismaClient,
): Promise<{
  id: string;
  bankId: string;
  prompt: string;
  config: unknown;
  points: number;
  status: "draft" | "published" | "archived";
  versionsCount: number;
}> {
  const r = await db.bankQuestion.findUnique({
    where: { id: questionId },
    select: {
      id: true,
      bankId: true,
      prompt: true,
      config: true,
      points: true,
      status: true,
      _count: { select: { versions: true } },
    },
  });
  if (!r) throw new ExamError("bank_question_not_found");
  return {
    id: r.id,
    bankId: r.bankId,
    prompt: r.prompt,
    config: r.config,
    points: r.points,
    status: r.status,
    versionsCount: r._count.versions,
  };
}

export const UpdateBankQuestionInput = z.object({
  prompt: z.string().min(1).max(10_000).optional(),
  config: z.record(z.unknown()).optional(),
  points: z.number().int().min(1).max(100).optional(),
  difficulty: z.number().int().min(1).max(5).optional(),
  estimatedTimeSec: z.number().int().min(1).max(3600).optional(),
  cognitiveLevel: CognitiveLevelEnum.optional(),
});

/**
 * Auto-snapshot rule: if the question is currently `published`, write the
 * pre-edit (prompt, config, points) into BankQuestionVersion before mutating
 * the live row. versionNumber auto-increments per question.
 *
 * draft / archived edits do NOT snapshot — drafts haven't been "released",
 * archived rows are frozen but shouldn't accumulate noise.
 */
export async function updateBankQuestion(
  actorUserId: string,
  questionId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<{ snapshottedAsVersion: number | null }> {
  const q = await loadBankQuestion(questionId, db);
  await assertCanEditBank(actorUserId, q.bankId, db);
  const parsed = UpdateBankQuestionInput.safeParse(rawInput);
  if (!parsed.success)
    throw new ExamError("validation_failed", parsed.error.flatten());
  if (q.status === "archived")
    throw new ExamError("bank_question_already_archived");
  const d = parsed.data;
  const data: {
    prompt?: string;
    config?: Prisma.InputJsonValue;
    points?: number;
    difficulty?: number;
    estimatedTimeSec?: number | null;
    cognitiveLevel?: "remember_understand" | "apply" | "analyze_plus";
  } = {};
  if (d.prompt !== undefined) data.prompt = d.prompt;
  if (d.config !== undefined) data.config = d.config as Prisma.InputJsonValue;
  if (d.points !== undefined) data.points = d.points;
  if (d.difficulty !== undefined) data.difficulty = d.difficulty;
  if (d.estimatedTimeSec !== undefined)
    data.estimatedTimeSec = d.estimatedTimeSec;
  if (d.cognitiveLevel !== undefined) data.cognitiveLevel = d.cognitiveLevel;
  if (Object.keys(data).length === 0) return { snapshottedAsVersion: null };

  return (db as typeof prisma).$transaction(async (tx) => {
    let snapshotVersion: number | null = null;
    if (q.status === "published") {
      snapshotVersion = q.versionsCount + 1;
      await tx.bankQuestionVersion.create({
        data: {
          bankQuestionId: q.id,
          versionNumber: snapshotVersion,
          prompt: q.prompt,
          config: q.config as Prisma.InputJsonValue,
          points: q.points,
        },
      });
    }
    await tx.bankQuestion.update({
      where: { id: q.id },
      data,
    });
    return { snapshottedAsVersion: snapshotVersion };
  });
}

/** A5.1 — Publish requires ≥1 skill tag (CLAUDE.md §4.4). */
export async function publishBankQuestion(
  actorUserId: string,
  questionId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const q = await loadBankQuestion(questionId, db);
  await assertCanEditBank(actorUserId, q.bankId, db);
  if (q.status === "published") return;
  if (q.status === "archived")
    throw new ExamError("bank_question_already_archived");
  const tagCount = await db.bankQuestionSkillTag.count({
    where: { bankQuestionId: questionId },
  });
  if (tagCount === 0) throw new ExamError("bank_question_not_publishable");
  await db.bankQuestion.update({
    where: { id: questionId },
    data: { status: "published" },
  });
}

export async function archiveBankQuestion(
  actorUserId: string,
  questionId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const q = await loadBankQuestion(questionId, db);
  await assertCanEditBank(actorUserId, q.bankId, db);
  if (q.status === "archived") return;
  await db.bankQuestion.update({
    where: { id: questionId },
    data: { status: "archived" },
  });
}

/** Skill-tag CRUD. */
export async function tagBankQuestion(
  actorUserId: string,
  questionId: string,
  skillId: string,
  weight: number = 1,
  db: PrismaClient = prisma,
): Promise<void> {
  const q = await loadBankQuestion(questionId, db);
  await assertCanEditBank(actorUserId, q.bankId, db);
  await db.bankQuestionSkillTag.upsert({
    where: { bankQuestionId_skillId: { bankQuestionId: questionId, skillId } },
    create: { bankQuestionId: questionId, skillId, weight },
    update: { weight },
  });
}

export async function untagBankQuestion(
  actorUserId: string,
  questionId: string,
  skillId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const q = await loadBankQuestion(questionId, db);
  await assertCanEditBank(actorUserId, q.bankId, db);
  await db.bankQuestionSkillTag.deleteMany({
    where: { bankQuestionId: questionId, skillId },
  });
}

// ============================================================================
// Search & cross-bank discovery
// ============================================================================

export interface SearchFilters {
  bankIds?: string[];
  type?: string[];
  difficulty?: number[];
  cognitiveLevel?: ("remember_understand" | "apply" | "analyze_plus")[];
  skillIds?: string[]; // ANY match
  status?: ("draft" | "published" | "archived")[];
  q?: string; // prompt contains
  limit?: number;
  cursor?: string;
}

export interface SearchResult {
  items: {
    id: string;
    bankId: string;
    bankName: string;
    type: string;
    prompt: string;
    points: number;
    difficulty: number;
    cognitiveLevel: "remember_understand" | "apply" | "analyze_plus";
    status: "draft" | "published" | "archived";
    skillIds: string[];
    updatedAt: string;
    stats: { pValueAvg: number; discriminationAvg: number; totalUses: number } | null;
    exposureCount: number;
    lastSampledAt: string | null;
  }[];
  nextCursor: string | null;
}

/** Return visible bank IDs the actor can read (= same scope as listBanks). */
async function visibleBankIds(
  actorUserId: string,
  db: PrismaClient,
): Promise<string[]> {
  const ci = await db.courseInstructor.findMany({
    where: { userId: actorUserId },
    select: { courseId: true },
  });
  const courseIds = ci.map((r) => r.courseId);
  const banks = await db.questionBank.findMany({
    where: {
      OR: [
        { ownerUserId: actorUserId },
        ...(courseIds.length > 0
          ? [{ visibility: "course" as const, courseId: { in: courseIds } }]
          : []),
      ],
    },
    select: { id: true },
  });
  return banks.map((b) => b.id);
}

export async function searchQuestions(
  actorUserId: string,
  filters: SearchFilters,
  db: PrismaClient = prisma,
): Promise<SearchResult> {
  const visibleIds = await visibleBankIds(actorUserId, db);
  const bankIds =
    filters.bankIds && filters.bankIds.length > 0
      ? filters.bankIds.filter((id) => visibleIds.includes(id))
      : visibleIds;
  if (bankIds.length === 0) return { items: [], nextCursor: null };

  const limit = Math.min(filters.limit ?? 30, 100);
  const where: Prisma.BankQuestionWhereInput = {
    bankId: { in: bankIds },
    ...(filters.status && filters.status.length > 0
      ? { status: { in: filters.status } }
      : { status: { not: "archived" } }),
    ...(filters.type && filters.type.length > 0
      ? { type: { in: filters.type as never } }
      : {}),
    ...(filters.difficulty && filters.difficulty.length > 0
      ? { difficulty: { in: filters.difficulty } }
      : {}),
    ...(filters.cognitiveLevel && filters.cognitiveLevel.length > 0
      ? { cognitiveLevel: { in: filters.cognitiveLevel as never } }
      : {}),
    ...(filters.q && filters.q.trim().length > 0
      ? { prompt: { contains: filters.q.trim(), mode: "insensitive" } }
      : {}),
    ...(filters.skillIds && filters.skillIds.length > 0
      ? { skillTags: { some: { skillId: { in: filters.skillIds } } } }
      : {}),
  };

  const rows = await db.bankQuestion.findMany({
    where,
    take: limit + 1,
    ...(filters.cursor
      ? { skip: 1, cursor: { id: filters.cursor } }
      : {}),
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      bankId: true,
      bank: { select: { name: true } },
      type: true,
      prompt: true,
      points: true,
      difficulty: true,
      cognitiveLevel: true,
      status: true,
      updatedAt: true,
      exposureCount: true,
      lastSampledAt: true,
      skillTags: { select: { skillId: true } },
      stats: { select: { pValueAvg: true, discriminationAvg: true, totalUses: true } },
    },
  });
  const hasNext = rows.length > limit;
  const items = (hasNext ? rows.slice(0, limit) : rows).map((r) => ({
    id: r.id,
    bankId: r.bankId,
    bankName: r.bank.name,
    type: r.type,
    prompt: r.prompt,
    points: r.points,
    difficulty: r.difficulty,
    cognitiveLevel: r.cognitiveLevel as "remember_understand" | "apply" | "analyze_plus",
    status: r.status,
    skillIds: r.skillTags.map((t) => t.skillId),
    updatedAt: r.updatedAt.toISOString(),
    stats: r.stats
      ? { pValueAvg: r.stats.pValueAvg, discriminationAvg: r.stats.discriminationAvg, totalUses: r.stats.totalUses }
      : null,
    exposureCount: r.exposureCount,
    lastSampledAt: r.lastSampledAt?.toISOString() ?? null,
  }));
  return {
    items,
    nextCursor: hasNext ? items[items.length - 1]!.id : null,
  };
}

// ============================================================================
// Copy to exam
// ============================================================================

/**
 * Copy a published BankQuestion into an ExamQuestion. Always writes a fresh
 * BankQuestionVersion snapshot of the current live state and links the new
 * ExamQuestion via ExamQuestionFromBank. Subsequent bank edits cannot mutate
 * the exam-side copy (frozen by the version snapshot).
 *
 * Guards:
 *   - bank question must be `published`
 *   - actor can edit the bank AND the exam
 *   - exam must be `draft` (no attempts yet) — same rule as direct authoring
 */
export async function copyBankQuestionToExam(
  actorUserId: string,
  bankQuestionId: string,
  examId: string,
  position?: { orderInExam?: number; passageId?: string | null },
  db: PrismaClient = prisma,
): Promise<{ examQuestionId: string; versionNumber: number }> {
  const q = await db.bankQuestion.findUnique({
    where: { id: bankQuestionId },
    select: {
      id: true,
      bankId: true,
      type: true,
      prompt: true,
      config: true,
      points: true,
      status: true,
      skillTags: { select: { skillId: true, weight: true } },
    },
  });
  if (!q) throw new ExamError("bank_question_not_found");
  await assertCanEditBank(actorUserId, q.bankId, db);
  if (q.status !== "published")
    throw new ExamError("bank_question_not_publishable");

  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { id: true, courseId: true, status: true },
  });
  if (!exam) throw new ExamError("exam_not_found");
  await assertCanEditCourse(actorUserId, exam.courseId, db);
  if (exam.status !== "draft") {
    // Published exam with attempts is frozen by `assertCanEditExam` elsewhere
    // — check attempts directly here for clarity.
    const attempts = await db.examAttempt.count({ where: { examId } });
    if (attempts > 0) throw new ExamError("exam_has_attempts");
  }

  // Resolve orderInExam: append to end if not specified.
  const next =
    position?.orderInExam ??
    ((await db.examQuestion.aggregate({
      where: { examId },
      _max: { orderInExam: true },
    }))._max.orderInExam ?? -1) + 1;

  return (db as typeof prisma).$transaction(async (tx) => {
    // Snapshot current bank state as a new version (immutable record of what
    // the exam captured).
    const latestVer = await tx.bankQuestionVersion.findFirst({
      where: { bankQuestionId: q.id },
      orderBy: { versionNumber: "desc" },
      select: { versionNumber: true },
    });
    const versionNumber = (latestVer?.versionNumber ?? 0) + 1;
    const version = await tx.bankQuestionVersion.create({
      data: {
        bankQuestionId: q.id,
        versionNumber,
        prompt: q.prompt,
        config: q.config as Prisma.InputJsonValue,
        points: q.points,
      },
      select: { id: true },
    });

    // Insert the ExamQuestion + skill tag copy + link row.
    const eq = await tx.examQuestion.create({
      data: {
        examId,
        passageId: position?.passageId ?? null,
        type: q.type,
        prompt: q.prompt,
        config: q.config as Prisma.InputJsonValue,
        points: q.points,
        orderInExam: next,
      },
      select: { id: true },
    });
    if (q.skillTags.length > 0) {
      await tx.examQuestionSkillTag.createMany({
        data: q.skillTags.map((t) => ({
          questionId: eq.id,
          skillId: t.skillId,
          weight: t.weight,
        })),
      });
    }
    await tx.examQuestionFromBank.create({
      data: {
        examQuestionId: eq.id,
        bankQuestionId: q.id,
        bankQuestionVersionId: version.id,
      },
    });
    return { examQuestionId: eq.id, versionNumber };
  });
}
