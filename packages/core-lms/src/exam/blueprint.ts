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

import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma, Prisma, type PrismaClient } from "@feedbackme/db";
import { assertCanEditExam } from "../courses/authz";
import { ExamError } from "./types";
import { resolveSkillScope, resolveBankScope } from "./wizard";
import { pickPoolQuestions, PoolFilter } from "./sections";

// ============================================================================
// Types
// ============================================================================

export const BlueprintModeSchema = z.enum(["skill_matrix", "topic_only"]);
export type BlueprintMode = z.infer<typeof BlueprintModeSchema>;

// Placeholder titles used to recognize a section as Blueprint-authored across
// re-assembles — see assembleExamFromBlueprint's replace-not-accumulate logic
// and importPreviewToExam's relabel-on-chốt logic below.
const BLUEPRINT_DRAFT_TITLE = "Câu hỏi (Blueprint)";
const BLUEPRINT_COMMITTED_TITLE = "Câu hỏi (đã chốt từ Blueprint)";

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
  const exam = await db.exam.findUnique({ where: { id: examId }, select: { courseId: true, createdById: true } });
  if (!exam) throw new ExamError("exam_not_found");
  await assertCanEditExam(actorUserId, exam, db);
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

export interface BlueprintLessonNode {
  id: string;
  title: string;
  bankCount: number;
}
export interface BlueprintModuleNode {
  id: string;
  title: string;
  lessons: BlueprintLessonNode[];
}

/**
 * Cây module → bài học kèm số câu hỏi bank đã publish cho mỗi bài, dùng để
 * populate UI chọn bài học của "Thiết kế đề theo ma trận đề thi" (skill_matrix
 * mode). Tách khỏi getBlueprint vì đây là dữ liệu SCOPE (đề có bài học nào),
 * không phải dữ liệu đã lưu của blueprint.
 */
export async function getBlueprintLessonTree(
  actorUserId: string,
  examId: string,
  db: PrismaClient = prisma,
): Promise<BlueprintModuleNode[]> {
  const exam = await db.exam.findUnique({ where: { id: examId }, select: { courseId: true, createdById: true } });
  if (!exam) throw new ExamError("exam_not_found");
  await assertCanEditExam(actorUserId, exam, db);
  if (!exam.courseId) {
    throw new ExamError("exam_not_written", {
      reason: "blueprint_requires_course",
      message: "Chức năng lấy mẫu từ ngân hàng câu hỏi chỉ dùng cho đề gắn khoá học.",
    });
  }

  const modules = await db.module.findMany({
    where: { courseId: exam.courseId },
    orderBy: { orderIndex: "asc" },
    select: {
      id: true,
      title: true,
      lessons: {
        orderBy: { orderIndex: "asc" },
        select: { id: true, title: true },
      },
    },
  });

  const lessonIds = modules.flatMap((m) => m.lessons.map((l) => l.id));
  const bankCountsRaw =
    lessonIds.length > 0
      ? await db.$queryRaw<{ lessonId: string; cnt: bigint }[]>`
          SELECT csm."contentId" AS "lessonId", COUNT(DISTINCT bq.id) AS cnt
          FROM "ContentSkillMapping" csm
          JOIN "BankQuestionSkillTag" bqst ON bqst."skillId" = csm."skillId"
          JOIN "BankQuestion" bq ON bq.id = bqst."bankQuestionId" AND bq.status = 'published'
          WHERE csm."contentType" = 'lesson'
            AND csm."contentId" = ANY(${lessonIds})
          GROUP BY csm."contentId"
        `
      : [];
  const bankCountMap = Object.fromEntries(bankCountsRaw.map((r) => [r.lessonId, Number(r.cnt)]));

  return modules.map((m) => ({
    id: m.id,
    title: m.title,
    lessons: m.lessons.map((l) => ({
      id: l.id,
      title: l.title,
      bankCount: bankCountMap[l.id] ?? 0,
    })),
  }));
}

export async function upsertBlueprint(
  actorUserId: string,
  examId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<BlueprintData> {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { courseId: true, createdById: true, kind: true },
  });
  if (!exam) throw new ExamError("exam_not_found");
  // A6.1 — Blueprint kéo câu hỏi từ ngân hàng; vô nghĩa với vấn đáp AI.
  if (exam.kind === "oral") throw new ExamError("exam_not_written");
  if (!exam.courseId) {
    throw new ExamError("exam_not_written", {
      reason: "blueprint_requires_course",
      message: "Chức năng lấy mẫu từ ngân hàng câu hỏi chỉ dùng cho đề gắn khoá học.",
    });
  }
  await assertCanEditExam(actorUserId, exam, db);

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
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { courseId: true, createdById: true },
  });
  if (!exam) throw new ExamError("exam_not_found");
  await assertCanEditExam(actorUserId, exam, db);
  if (!exam.courseId) {
    throw new ExamError("exam_not_written", {
      reason: "blueprint_requires_course",
      message: "Chức năng lấy mẫu từ ngân hàng câu hỏi chỉ dùng cho đề gắn khoá học.",
    });
  }

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
  /** Thu hẹp về 1 (hoặc vài) ngân hàng cụ thể — GV chọn ở UI "Theo ma trận đề
   *  thi". Bỏ trống = auto-scope mọi ngân hàng GV có quyền (hành vi cũ). Luôn
   *  giao với resolveBankScope — id ngoài phạm vi bị bỏ qua, không leak. */
  explicitBankIds?: string[],
): Promise<BlueprintPreviewResult> {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { courseId: true, createdById: true },
  });
  if (!exam) throw new ExamError("exam_not_found");
  await assertCanEditExam(actorUserId, exam, db);
  if (!exam.courseId) {
    throw new ExamError("exam_not_written", {
      reason: "blueprint_requires_course",
      message: "Chức năng lấy mẫu từ ngân hàng câu hỏi chỉ dùng cho đề gắn khoá học.",
    });
  }

  const activeCells = cells.filter((c) => c.count > 0);
  const totalRequested = activeCells.reduce((s, c) => s + c.count, 0);

  const scopeBankIds = await resolveBankScope(exam.courseId, actorUserId, db);
  const bankIds =
    explicitBankIds && explicitBankIds.length > 0
      ? scopeBankIds.filter((id) => explicitBankIds.includes(id))
      : scopeBankIds;

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
  /** Thu hẹp về 1 ngân hàng cụ thể — xem ghi chú ở previewBlueprintTopicOnly. */
  explicitBankId?: string,
): Promise<{ topic: string; count: number; publishedCount: number }[]> {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { courseId: true, createdById: true },
  });
  if (!exam) throw new ExamError("exam_not_found");
  await assertCanEditExam(actorUserId, exam, db);
  if (!exam.courseId) {
    throw new ExamError("exam_not_written", {
      reason: "blueprint_requires_course",
      message: "Chức năng lấy mẫu từ ngân hàng câu hỏi chỉ dùng cho đề gắn khoá học.",
    });
  }

  const scopeBankIds = await resolveBankScope(exam.courseId, actorUserId, db);
  const bankIds = explicitBankId
    ? scopeBankIds.filter((id) => id === explicitBankId)
    : scopeBankIds;
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
    select: { courseId: true, createdById: true, status: true },
  });
  if (!exam) throw new ExamError("exam_not_found");
  if (exam.status !== "draft") throw new ExamError("exam_not_draft");
  await assertCanEditExam(actorUserId, exam, db);
  if (!exam.courseId) {
    throw new ExamError("exam_not_written", {
      reason: "blueprint_requires_course",
      message: "Chức năng lấy mẫu từ ngân hàng câu hỏi chỉ dùng cho đề gắn khoá học.",
    });
  }

  const bp = await db.examBlueprint.findUnique({ where: { examId } });
  if (!bp) throw new ExamError("exam_not_found"); // blueprint must exist first

  const mode = readMode((bp as { mode?: unknown }).mode);
  const cells = bp.cells as Array<Record<string, unknown> & { count: number }>;
  const activeCells = cells.filter((c) => c.count > 0);
  if (activeCells.length === 0) {
    throw new ExamError("validation_failed", "Blueprint has no cells with count > 0");
  }

  const scopeBankIds = await resolveBankScope(exam.courseId, actorUserId, db);
  const savedBankIds = (bp as { bankIds?: string[] }).bankIds ?? [];
  // Blueprint topic_only đã lưu 1 ngân hàng cụ thể (GV chọn ở UI) → giữ đúng
  // ngân hàng đó thay vì auto-scope lại toàn bộ; giao với resolveBankScope để
  // không lỡ dùng 1 id GV không còn quyền (đổi vai trò sau khi lưu).
  const bankIds =
    savedBankIds.length > 0
      ? scopeBankIds.filter((id) => savedBankIds.includes(id))
      : scopeBankIds;

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

  // Find existing random_from_bank section (chưa chốt) để cập nhật in-place,
  // hoặc — nếu lần trước đã chốt rồi (section giờ là "fixed" mang câu hỏi
  // thật) — xoá hẳn batch cũ trước khi tạo batch mới, để bấm lại nút này
  // THAY THẾ chứ không cộng dồn section/câu hỏi qua từng lần bấm.
  const existingDraft = await db.examSection.findFirst({
    where: { examId, selectionMode: "random_from_bank" },
    select: { id: true },
  });

  if (!existingDraft) {
    const previousCommitted = await db.examSection.findFirst({
      where: { examId, selectionMode: "fixed", title: BLUEPRINT_COMMITTED_TITLE },
      select: { id: true },
    });
    if (previousCommitted) {
      const items = await db.examSectionItem.findMany({
        where: { sectionId: previousCommitted.id },
        select: { examQuestionId: true },
      });
      const questionIds = items.map((i) => i.examQuestionId);
      await db.$transaction([
        db.examQuestionSkillTag.deleteMany({ where: { questionId: { in: questionIds } } }),
        db.examQuestionFromBank.deleteMany({ where: { examQuestionId: { in: questionIds } } }),
        db.examSectionItem.deleteMany({ where: { sectionId: previousCommitted.id } }),
        db.examQuestion.deleteMany({ where: { id: { in: questionIds } } }),
        db.examSection.delete({ where: { id: previousCommitted.id } }),
      ]);
    }
  }

  let sectionId: string;
  const replaced = existingDraft !== null;

  if (existingDraft) {
    await db.examSection.update({
      where: { id: existingDraft.id },
      data: {
        poolFilter: poolFilter as never,
        // Re-label so instructor can see it was re-assembled.
        title: BLUEPRINT_DRAFT_TITLE,
      },
    });
    sectionId = existingDraft.id;
  } else {
    const created = await db.examSection.create({
      data: {
        examId,
        title: BLUEPRINT_DRAFT_TITLE,
        orderIndex: 0,
        selectionMode: "random_from_bank",
        // per_attempt bị bỏ khỏi UI (BankPickerModal) vì màn thi chưa đọc
        // được section ngẫu nhiên dạng "sample lúc vào thi" — cùng lý do,
        // pool từ blueprint cũng chỉ có per_publish là đường thật sự chốt
        // được thành câu hỏi hiển thị cho học sinh (qua import-preview).
        resolutionMode: "per_publish",
        poolFilter: poolFilter as never,
      },
      select: { id: true },
    });
    sectionId = created.id;
  }

  return { sectionId, replaced, totalCount: bp.totalCount };
}

// ============================================================================
// Preview pool — sample N câu để instructor xem trước khi học viên làm
// ============================================================================

export interface SectionPoolPreviewQuestion {
  id: string;
  code: string | null;
  prompt: string;
  type: string;
  difficulty: number;
  cognitiveLevel: "remember_understand" | "apply" | "analyze_plus";
  topic: string | null;
  /** Letter(s) đáp án đúng cho MCQ ("B" hoặc "A,C") hoặc "Đúng"/"Sai" cho TF. */
  correctPreview: string | null;
  /** Bucket cell (topic / cog / diff) bucket nào sample ra câu này (debug). */
  bucketIndex: number | null;
}

export interface SectionPoolPreviewResult {
  sectionId: string;
  totalRequested: number;
  totalSampled: number;
  questions: SectionPoolPreviewQuestion[];
  seed: string;
}

function extractCorrectPreview(
  type: string,
  config: unknown,
): string | null {
  if (!config || typeof config !== "object") return null;
  const c = config as Record<string, unknown>;
  if (type === "mcq" || type === "multi") {
    const opts = c.options as
      | Array<{ id?: string; isCorrect?: boolean }>
      | undefined;
    if (!Array.isArray(opts)) return null;
    const letters = opts
      .filter((o) => o.isCorrect)
      .map((o) => (typeof o.id === "string" ? o.id.toUpperCase() : ""))
      .filter(Boolean);
    return letters.length > 0 ? letters.join(",") : null;
  }
  if (type === "true_false_notgiven") {
    const v = (c.correct ?? c.correctValue) as unknown;
    if (v === "true" || v === true) return "Đúng";
    if (v === "false" || v === false) return "Sai";
    if (v === "not_given" || v === "notgiven") return "N/G";
  }
  return null;
}

/**
 * Sample N câu cụ thể cho 1 ExamSection random_from_bank để instructor xem
 * danh sách trước khi học viên làm. Seed mặc định = "preview:{sectionId}" để
 * 2 lần gọi liên tiếp trả về cùng list (deterministic) — instructor truyền
 * `reshuffle=true` để dùng seed ngẫu nhiên 1 lần (xem ví dụ khác).
 *
 * Authz: edit-course.
 */
export async function previewSectionPool(
  actorUserId: string,
  examId: string,
  sectionId: string,
  opts: { reshuffleSeed?: string } = {},
  db: PrismaClient = prisma,
): Promise<SectionPoolPreviewResult> {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { courseId: true, createdById: true },
  });
  if (!exam) throw new ExamError("exam_not_found");
  await assertCanEditExam(actorUserId, exam, db);

  const section = await db.examSection.findFirst({
    where: { id: sectionId, examId },
    select: { id: true, selectionMode: true, poolFilter: true },
  });
  if (!section) throw new ExamError("section_not_found");
  if (section.selectionMode !== "random_from_bank")
    throw new ExamError("validation_failed", "Section không phải random_from_bank");

  const filterParsed = PoolFilter.safeParse(section.poolFilter);
  if (!filterParsed.success)
    throw new ExamError("validation_failed", "poolFilter không hợp lệ");

  const seedInput = opts.reshuffleSeed ?? `preview:${sectionId}`;
  const seed = createHash("sha256").update(seedInput).digest("hex");
  // Tolerant: instructor xem preview, pool thiếu thì show partial + cảnh báo —
  // không phải fail giống attempt runtime (học viên không được nhận đề thiếu).
  const ids = await pickPoolQuestions(filterParsed.data, seed, db, { tolerant: true });

  // Load chi tiết theo thứ tự pickPoolQuestions trả về.
  const rows = await db.bankQuestion.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      code: true,
      prompt: true,
      type: true,
      config: true,
      difficulty: true,
      cognitiveLevel: true,
    },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));

  // Map bucket index (vị trí cell trong filter.buckets) cho từng id — debug
  // giúp instructor verify phân bổ M-level đúng intent.
  const bucketByPos: number[] = [];
  if (filterParsed.data.buckets && filterParsed.data.buckets.length > 0) {
    let pos = 0;
    for (const [i, b] of filterParsed.data.buckets.entries()) {
      const take = Math.min(b.count, ids.length - pos);
      for (let k = 0; k < take; k++) bucketByPos[pos + k] = i;
      pos += b.count;
    }
  }

  const questions: SectionPoolPreviewQuestion[] = ids.map((id, pos) => {
    const r = byId.get(id);
    if (!r) {
      return {
        id,
        code: null,
        prompt: "(không tìm thấy câu hỏi)",
        type: "unknown",
        difficulty: 0,
        cognitiveLevel: "apply" as const,
        topic: null,
        correctPreview: null,
        bucketIndex: bucketByPos[pos] ?? null,
      };
    }
    const cfg = r.config as Record<string, unknown> | null;
    const topic =
      cfg && typeof cfg.topic === "string" ? (cfg.topic as string) : null;
    return {
      id: r.id,
      code: r.code,
      prompt: r.prompt,
      type: r.type,
      difficulty: r.difficulty,
      cognitiveLevel: r.cognitiveLevel as "remember_understand" | "apply" | "analyze_plus",
      topic,
      correctPreview: extractCorrectPreview(r.type, r.config),
      bucketIndex: bucketByPos[pos] ?? null,
    };
  });

  return {
    sectionId,
    totalRequested: filterParsed.data.count,
    totalSampled: questions.length,
    questions,
    seed: seedInput,
  };
}

// ============================================================================
// Import preview pool → fixed section (mỗi câu thành 1 ExamQuestion)
// ============================================================================

export interface ImportPreviewResult {
  sectionId: string;
  imported: number;
  skipped: { id: string; reason: string }[];
}

/**
 * Convert section random_from_bank thành fixed: sample IDs theo seed, copy
 * mỗi BankQuestion thành ExamQuestion (+ ExamQuestionFromBank link + skill
 * tag copy + version snapshot), link qua ExamSectionItem theo thứ tự sample.
 * Section đổi `selectionMode` từ `random_from_bank` sang `fixed`, xoá poolFilter.
 *
 * Sau import, mọi học viên đều thấy **cùng** N câu (không còn per-attempt
 * randomization). Instructor có thể sửa/reorder từng câu trong tab Nội dung.
 *
 * Idempotent: gọi lại trên section đã fixed → throw `validation_failed`.
 * Authz: edit-course + exam phải draft (chưa có attempt).
 */
export async function importPreviewToExam(
  actorUserId: string,
  examId: string,
  sectionId: string,
  opts: { reshuffleSeed?: string } = {},
  db: PrismaClient = prisma,
): Promise<ImportPreviewResult> {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { id: true, courseId: true, createdById: true, status: true },
  });
  if (!exam) throw new ExamError("exam_not_found");
  await assertCanEditExam(actorUserId, exam, db);
  if (exam.status !== "draft") throw new ExamError("exam_not_draft");

  const section = await db.examSection.findFirst({
    where: { id: sectionId, examId },
    select: { id: true, title: true, selectionMode: true, poolFilter: true },
  });
  if (!section) throw new ExamError("section_not_found");
  if (section.selectionMode !== "random_from_bank")
    throw new ExamError(
      "validation_failed",
      "Section đã ở mode fixed — không cần import",
    );

  const filterParsed = PoolFilter.safeParse(section.poolFilter);
  if (!filterParsed.success)
    throw new ExamError("validation_failed", "poolFilter không hợp lệ");

  // Sample IDs với seed như preview-pool route, để instructor nhận đúng bộ
  // câu họ vừa thấy trên UI.
  const seedInput = opts.reshuffleSeed ?? `preview:${sectionId}`;
  const seed = createHash("sha256").update(seedInput).digest("hex");
  const ids = await pickPoolQuestions(filterParsed.data, seed, db, {
    tolerant: true,
  });
  if (ids.length === 0) throw new ExamError("section_pool_empty");

  // Load chi tiết bank questions để snapshot version + copy config.
  const banks = await db.bankQuestion.findMany({
    where: { id: { in: ids } },
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
  const byId = new Map(banks.map((b) => [b.id, b]));

  // Lấy orderInExam start để câu mới append sau câu đã có (nếu có).
  const maxOrder =
    (await db.examQuestion.aggregate({
      where: { examId },
      _max: { orderInExam: true },
    }))._max.orderInExam ?? -1;

  const skipped: { id: string; reason: string }[] = [];

  // Chỉ đổi label sang "đã chốt từ Blueprint" khi section thực sự đến từ
  // Blueprint (còn mang tên placeholder mặc định "Câu hỏi (Blueprint)").
  // Section do SectionsPanel/BankPickerModal tạo mang tên do người dùng
  // chọn (vd "Rút ngẫu nhiên từ ngân hàng", "Phần I — Trắc nghiệm") — giữ
  // nguyên, không ghi đè thành nhãn Blueprint gây hiểu nhầm.
  const nextTitle =
    section.title === BLUEPRINT_DRAFT_TITLE ? BLUEPRINT_COMMITTED_TITLE : section.title;

  await (db as typeof prisma).$transaction(async (tx) => {
    // Đổi section thành fixed trước (defensive — nếu tx fail, schema vẫn nhất quán).
    await tx.examSection.update({
      where: { id: sectionId },
      data: {
        selectionMode: "fixed",
        poolFilter: Prisma.JsonNull,
        title: nextTitle,
      },
    });

    let orderCursor = maxOrder + 1;
    let sectionOrder = 0;

    for (const id of ids) {
      const q = byId.get(id);
      if (!q) {
        skipped.push({ id, reason: "Không tìm thấy" });
        continue;
      }
      if (q.status !== "published") {
        skipped.push({ id, reason: `Không published (${q.status})` });
        continue;
      }

      // Version snapshot trước copy (giống copyBankQuestionToExam).
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

      const eq = await tx.examQuestion.create({
        data: {
          examId,
          type: q.type,
          prompt: q.prompt,
          config: q.config as Prisma.InputJsonValue,
          points: q.points,
          orderInExam: orderCursor++,
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

      await tx.examSectionItem.create({
        data: {
          sectionId,
          examQuestionId: eq.id,
          orderInSection: sectionOrder++,
          points: q.points,
        },
      });
    }
  });

  return {
    sectionId,
    imported: ids.length - skipped.length,
    skipped,
  };
}
