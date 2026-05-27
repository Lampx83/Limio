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

/**
 * Hard-delete a QuestionBank. Cascade-aware:
 *   - BankQuestion / BankQuestionVersion / BankQuestionSkillTag / BankQuestionStats
 *     all have ON DELETE CASCADE — drop automatically when the parent goes.
 *   - ExamQuestionFromBank.bankQuestion does NOT cascade (default NoAction),
 *     so Postgres would reject the delete if any bank question has been copied
 *     into an exam. Pre-count and:
 *       - `force=false` (default) → throw `bank_has_used_questions` with the
 *          count, let the UI ask for confirmation.
 *       - `force=true` → wipe ExamQuestionFromBank rows for this bank's
 *          questions inside the same transaction, then delete. The exam
 *          retains its frozen ExamQuestion copies (not affected) — just loses
 *          the back-link to the source bank entry. Item analytics keeps
 *          working from the exam side.
 *
 * Authz: actor must own the bank OR be an instructor of the bank's course.
 * (Same rule as assertCanEditBank above.)
 */
export async function deleteBank(
  actorUserId: string,
  bankId: string,
  opts: { force?: boolean } = {},
  db: PrismaClient = prisma,
): Promise<{ deleted: true; unlinkedFromExams: number }> {
  await assertCanEditBank(actorUserId, bankId, db);

  // Count back-links from exams. Joined via BankQuestion → bank.
  const usedCount = await db.examQuestionFromBank.count({
    where: { bankQuestion: { bankId } },
  });
  if (usedCount > 0 && !opts.force) {
    throw new ExamError("bank_has_used_questions", { usedCount });
  }

  await db.$transaction(async (tx) => {
    if (usedCount > 0) {
      // Force path: drop the back-links first, then the bank cascades the
      // rest. ExamQuestion copies in the exam side are untouched.
      await tx.examQuestionFromBank.deleteMany({
        where: { bankQuestion: { bankId } },
      });
    }
    await tx.questionBank.delete({ where: { id: bankId } });
  });

  return { deleted: true, unlinkedFromExams: usedCount };
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

/**
 * Liệt kê các giá trị topic distinct trong 1 bank — dùng cho UI filter.
 * Topic được lưu trong BankQuestion.config.topic (set bởi MCQ import).
 * Trả về sorted alphabetically (vi-VN locale) để dropdown ổn định.
 *
 * Authz: actor phải thấy được bank (owner OR course instructor).
 */
export async function listTopicsInBank(
  actorUserId: string,
  bankId: string,
  db: PrismaClient = prisma,
): Promise<string[]> {
  const visibleIds = await visibleBankIds(actorUserId, db);
  if (!visibleIds.includes(bankId)) return [];
  // Raw query: extract config->>'topic' distinct. Postgres-only.
  const rows = await db.$queryRaw<Array<{ topic: string | null }>>`
    SELECT DISTINCT (config->>'topic') AS topic
    FROM "BankQuestion"
    WHERE "bankId" = ${bankId}
      AND config ? 'topic'
      AND config->>'topic' <> ''
  `;
  const topics = rows
    .map((r) => r.topic)
    .filter((t): t is string => !!t && t.trim() !== "");
  return topics.sort((a, b) => a.localeCompare(b, "vi-VN"));
}

/**
 * Hard-delete a single BankQuestion. Cascade aware (giống deleteBank):
 *   - BankQuestionVersion / BankQuestionSkillTag / BankQuestionStats cascade
 *     khi xoá row chính.
 *   - ExamQuestionFromBank.bankQuestion KHÔNG cascade (default NoAction) →
 *     nếu câu đã được copy vào đề thi nào thì Postgres reject.
 *
 * `force=false` (default) + đã dùng → throw `bank_question_in_use` với usedCount.
 * `force=true` → wipe ExamQuestionFromBank cho câu này rồi xoá. ExamQuestion
 *   bản sao trong đề không bị xoá (chỉ mất back-link về bank).
 *
 * Authz: same as edit (owner OR course instructor).
 */
export async function deleteBankQuestion(
  actorUserId: string,
  questionId: string,
  opts: { force?: boolean } = {},
  db: PrismaClient = prisma,
): Promise<{ deleted: true; unlinkedFromExams: number }> {
  const q = await loadBankQuestion(questionId, db);
  await assertCanEditBank(actorUserId, q.bankId, db);

  const usedCount = await db.examQuestionFromBank.count({
    where: { bankQuestionId: questionId },
  });
  if (usedCount > 0 && !opts.force) {
    throw new ExamError("bank_question_in_use", { usedCount });
  }

  await db.$transaction(async (tx) => {
    if (usedCount > 0) {
      await tx.examQuestionFromBank.deleteMany({
        where: { bankQuestionId: questionId },
      });
    }
    await tx.bankQuestion.delete({ where: { id: questionId } });
  });

  return { deleted: true, unlinkedFromExams: usedCount };
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
  /**
   * Topic / chủ đề — exact match per topic string. ANY of list matches.
   * Topic được lưu trong `BankQuestion.config.topic` (set bởi MCQ import).
   * Postgres JSON path filter để match.
   */
  topics?: string[];
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
    config: Record<string, unknown> | null;
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
  /** Total số câu khớp filter (toàn bộ, không bị giới hạn `limit`). */
  totalMatching: number;
  /** Total số câu (non-archived) trong scope bank — null khi multi-bank. */
  totalInBank: number | null;
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
  if (bankIds.length === 0)
    return { items: [], nextCursor: null, totalMatching: 0, totalInBank: null };

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
    // Topic filter — match BankQuestion.config.topic against any of the
    // provided strings. Postgres JSON path: config -> 'topic' = ANY(...).
    // Prisma's OR list keeps the queryable per topic value.
    ...(filters.topics && filters.topics.length > 0
      ? {
          OR: filters.topics.map((t) => ({
            config: { path: ["topic"], equals: t },
          })),
        }
      : {}),
  };

  // Đếm song song findMany để UI hiển thị "X câu khớp" + chọn "Tất cả X".
  // Cũng count tổng câu trong bank (cho header "281 câu") khi single-bank scope.
  const singleBankId = bankIds.length === 1 ? bankIds[0] : null;
  const [rows, totalMatching, totalInBank] = await Promise.all([
    db.bankQuestion.findMany({
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
        // Include config so the bank workbench can show the correct answer per
        // question (which option is the right one for MCQ, the correct value
        // for true_false_notgiven, the accepted answers for gap_fill etc).
        // Workbench is instructor-only, so leaking answer keys is fine.
        config: true,
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
    }),
    db.bankQuestion.count({ where }),
    singleBankId
      ? db.bankQuestion.count({
          where: { bankId: singleBankId, status: { not: "archived" } },
        })
      : Promise.resolve(null),
  ]);
  const hasNext = rows.length > limit;
  const items = (hasNext ? rows.slice(0, limit) : rows).map((r) => ({
    id: r.id,
    bankId: r.bankId,
    bankName: r.bank.name,
    type: r.type,
    prompt: r.prompt,
    config: r.config as Record<string, unknown> | null,
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
    totalMatching,
    totalInBank,
  };
}

/**
 * Trả về ID của tất cả câu hỏi khớp filter (không phân trang).
 * Dùng cho "Chọn tất cả X câu đang lọc" trong bulk action.
 * Giới hạn 5000 để tránh OOM.
 */
export async function listMatchingQuestionIds(
  actorUserId: string,
  filters: Omit<SearchFilters, "cursor" | "limit">,
  db: PrismaClient = prisma,
): Promise<string[]> {
  const visibleIds = await visibleBankIds(actorUserId, db);
  const bankIds =
    filters.bankIds && filters.bankIds.length > 0
      ? filters.bankIds.filter((id) => visibleIds.includes(id))
      : visibleIds;
  if (bankIds.length === 0) return [];
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
    ...(filters.topics && filters.topics.length > 0
      ? {
          OR: filters.topics.map((t) => ({
            config: { path: ["topic"], equals: t },
          })),
        }
      : {}),
  };
  const rows = await db.bankQuestion.findMany({
    where,
    take: 5000,
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/**
 * Bulk update status cho nhiều câu hỏi cùng lúc. Authz: tất cả câu phải thuộc
 * bank actor có quyền edit. Publish skip những câu chưa tag skill (return trong
 * `skipped` thay vì throw — để UI hiển thị warning per-row).
 */
export async function bulkUpdateBankQuestionStatus(
  actorUserId: string,
  questionIds: string[],
  action: "publish" | "archive" | "draft",
  db: PrismaClient = prisma,
): Promise<{
  ok: string[];
  skipped: { id: string; reason: string }[];
}> {
  if (questionIds.length === 0) return { ok: [], skipped: [] };
  if (questionIds.length > 1000)
    throw new ExamError("validation_failed", "Tối đa 1000 câu mỗi bulk");

  // Load tất cả câu + bank ownership trong 1 query.
  const rows = await db.bankQuestion.findMany({
    where: { id: { in: questionIds } },
    select: {
      id: true,
      bankId: true,
      status: true,
      _count: { select: { skillTags: true } },
    },
  });
  const foundIds = new Set(rows.map((r) => r.id));
  const ok: string[] = [];
  const skipped: { id: string; reason: string }[] = [];

  // Authz check 1 lần per bank (cache).
  const bankAuthCache = new Map<string, boolean>();
  const isBankEditable = async (bankId: string) => {
    if (bankAuthCache.has(bankId)) return bankAuthCache.get(bankId)!;
    try {
      await assertCanEditBank(actorUserId, bankId, db);
      bankAuthCache.set(bankId, true);
      return true;
    } catch {
      bankAuthCache.set(bankId, false);
      return false;
    }
  };

  for (const id of questionIds) {
    if (!foundIds.has(id)) {
      skipped.push({ id, reason: "Không tìm thấy" });
      continue;
    }
    const r = rows.find((x) => x.id === id)!;
    if (!(await isBankEditable(r.bankId))) {
      skipped.push({ id, reason: "Không có quyền edit bank" });
      continue;
    }
    if (action === "publish") {
      if (r.status === "published") {
        ok.push(id); // idempotent
        continue;
      }
      if (r.status === "archived") {
        skipped.push({ id, reason: "Câu đã lưu trữ — phải khôi phục về draft trước" });
        continue;
      }
      if (r._count.skillTags === 0) {
        skipped.push({ id, reason: "Chưa tag skill — không publish được" });
        continue;
      }
      ok.push(id);
    } else if (action === "archive") {
      if (r.status === "archived") {
        ok.push(id);
        continue;
      }
      ok.push(id);
    } else if (action === "draft") {
      if (r.status === "draft") {
        ok.push(id);
        continue;
      }
      ok.push(id);
    }
  }

  if (ok.length > 0) {
    const newStatus =
      action === "publish" ? "published" : action === "archive" ? "archived" : "draft";
    await db.bankQuestion.updateMany({
      where: { id: { in: ok } },
      data: { status: newStatus },
    });
  }

  return { ok, skipped };
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
