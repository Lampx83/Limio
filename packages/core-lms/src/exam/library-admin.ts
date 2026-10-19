import { z } from "zod";
import { prisma, type Prisma, type PrismaClient } from "@feedbackme/db";
import { assertCanEditCourse } from "../courses/authz";
import { cloneExam } from "./clone";
import { publishExam, updateExam } from "./exams";
import { ExamError } from "./types";

/**
 * LANG L6.6 / L6.7 — quản lý hàng trăm đề của khoá luyện đề (phía GIẢNG VIÊN): bảng phân trang phía máy chủ,
 * thao tác hàng loạt báo kết quả TỪNG DÒNG (một đề hỏng không làm hỏng các đề khác), quản lý bộ/Part/chủ đề.
 * Mọi hàm kiểm quyền sửa khoá.
 */

export const TABLE_DEFAULT_PAGE_SIZE = 50;
export const TABLE_MAX_PAGE_SIZE = 100;
export const BULK_MAX_EXAMS = 200;

export type TableSort = "seq" | "title" | "status" | "updatedAt" | "difficulty";

export interface TableFilters {
  q?: string;
  /** Id bộ, hoặc "none" = chưa thuộc bộ nào. */
  collectionId?: string;
  paperType?: "official" | "mock" | "practice_set";
  status?: "draft" | "published" | "archived";
  difficulty?: number;
  year?: string;
  freePreview?: boolean;
  sort?: TableSort;
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface TableRow {
  id: string;
  title: string;
  status: string;
  collectionId: string | null;
  collectionTitle: string | null;
  seq: number | null;
  paperType: string | null;
  sourceLabel: string | null;
  yearLabel: string | null;
  difficulty: number | null;
  tags: string[];
  freePreview: boolean;
  allowMock: boolean;
  allowPractice: boolean;
  sectionCount: number;
  questionCount: number;
  attemptCount: number;
  updatedAt: Date;
}

export async function listCourseExamsTable(
  actorUserId: string,
  courseId: string,
  f: TableFilters = {},
  db: PrismaClient = prisma,
): Promise<{ rows: TableRow[]; total: number; page: number; pageSize: number }> {
  await assertCanEditCourse(actorUserId, courseId, db);
  const and: Prisma.ExamWhereInput[] = [];
  if (f.collectionId === "none") and.push({ collectionId: null });
  else if (f.collectionId) and.push({ collectionId: f.collectionId });
  if (f.paperType) and.push({ paperType: f.paperType });
  if (f.difficulty) and.push({ difficulty: f.difficulty });
  if (f.year) and.push({ yearLabel: f.year });
  if (f.freePreview !== undefined) and.push({ freePreview: f.freePreview });
  const q = f.q?.trim();
  if (q) {
    and.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { sourceLabel: { contains: q, mode: "insensitive" } },
        { tags: { hasSome: [q, q.toLowerCase(), q.toUpperCase()] } },
      ],
    });
  }
  const where: Prisma.ExamWhereInput = {
    courseId,
    mockMode: true,
    kind: "written",
    status: f.status ?? { not: "archived" },
    ...(and.length ? { AND: and } : {}),
  };

  const dir = f.dir === "desc" ? "desc" : "asc";
  const orderBy: Prisma.ExamOrderByWithRelationInput[] =
    f.sort === "title" ? [{ title: dir }]
    : f.sort === "status" ? [{ status: dir }, { title: "asc" }]
    : f.sort === "updatedAt" ? [{ updatedAt: dir }]
    : f.sort === "difficulty" ? [{ difficulty: { sort: dir, nulls: "last" } }, { title: "asc" }]
    : [{ seq: { sort: dir, nulls: "last" } }, { title: "asc" }];

  const pageSize = Math.min(TABLE_MAX_PAGE_SIZE, Math.max(1, Math.trunc(f.pageSize ?? TABLE_DEFAULT_PAGE_SIZE)));
  const page = Math.max(1, Math.trunc(f.page ?? 1));
  const [total, rows] = await Promise.all([
    db.exam.count({ where }),
    db.exam.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, title: true, status: true, collectionId: true, seq: true, paperType: true, sourceLabel: true, yearLabel: true,
        difficulty: true, tags: true, freePreview: true, allowMock: true, allowPractice: true, updatedAt: true,
        collection: { select: { title: true } },
        _count: { select: { sections: true, questions: true, attempts: true } },
      },
    }),
  ]);
  return {
    total,
    page,
    pageSize,
    rows: rows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      collectionId: r.collectionId,
      collectionTitle: r.collection?.title ?? null,
      seq: r.seq,
      paperType: r.paperType,
      sourceLabel: r.sourceLabel,
      yearLabel: r.yearLabel,
      difficulty: r.difficulty,
      tags: r.tags,
      freePreview: r.freePreview,
      allowMock: r.allowMock,
      allowPractice: r.allowPractice,
      sectionCount: r._count.sections,
      questionCount: r._count.questions,
      attemptCount: r._count.attempts,
      updatedAt: r.updatedAt,
    })),
  };
}

// ─── Thao tác hàng loạt ───────────────────────────────────────────────────────

const BulkPatch = z
  .object({
    paperType: z.enum(["official", "mock", "practice_set"]).nullable(),
    sourceLabel: z.string().trim().max(120).nullable(),
    yearLabel: z.string().trim().max(40).nullable(),
    difficulty: z.number().int().min(1).max(5).nullable(),
    tags: z.array(z.string().trim().min(1).max(40)).max(20),
    freePreview: z.boolean(),
    allowMock: z.boolean(),
    allowPractice: z.boolean(),
    collectionId: z.string().uuid().nullable(),
  })
  .partial();

const BulkInput = z.object({
  action: z.enum(["update", "publish", "archive", "clone"]),
  examIds: z.array(z.string().uuid()).min(1).max(BULK_MAX_EXAMS),
  patch: BulkPatch.optional(),
  tagsMode: z.enum(["set", "add", "remove"]).default("set"),
});
export type BulkExamInput = z.input<typeof BulkInput>;

export type BulkRowResult = { examId: string; ok: true; newExamId?: string } | { examId: string; ok: false; error: string };

const errCode = (e: unknown): string => {
  const code = (e as { code?: unknown })?.code;
  return typeof code === "string" ? code : "error";
};

export async function bulkExamAction(
  actorUserId: string,
  courseId: string,
  rawInput: BulkExamInput,
  db: PrismaClient = prisma,
): Promise<{ results: BulkRowResult[] }> {
  await assertCanEditCourse(actorUserId, courseId, db);
  const parsed = BulkInput.safeParse(rawInput);
  if (!parsed.success) throw new ExamError("validation_failed", parsed.error.flatten());
  const { action, examIds, patch, tagsMode } = parsed.data;

  const found = await db.exam.findMany({ where: { id: { in: examIds } }, select: { id: true, courseId: true, tags: true, status: true } });
  const byId = new Map(found.map((e) => [e.id, e]));
  const results: BulkRowResult[] = [];
  for (const examId of examIds) {
    const e = byId.get(examId);
    if (!e) {
      results.push({ examId, ok: false, error: "exam_not_found" });
      continue;
    }
    if (e.courseId !== courseId) {
      results.push({ examId, ok: false, error: "exam_not_in_course" });
      continue;
    }
    try {
      if (action === "update") {
        const next: Record<string, unknown> = { ...(patch ?? {}) };
        if (patch?.tags) {
          next.tags =
            tagsMode === "add" ? [...new Set([...e.tags, ...patch.tags])]
            : tagsMode === "remove" ? e.tags.filter((t) => !patch.tags!.includes(t))
            : patch.tags;
        }
        await updateExam(actorUserId, examId, next, db);
        results.push({ examId, ok: true });
      } else if (action === "publish") {
        await publishExam(actorUserId, examId, db);
        results.push({ examId, ok: true });
      } else if (action === "archive") {
        if (e.status !== "archived") await db.exam.update({ where: { id: examId }, data: { status: "archived" } });
        results.push({ examId, ok: true });
      } else {
        const c = await cloneExam(actorUserId, examId, {}, db);
        results.push({ examId, ok: true, newExamId: c.examId });
      }
    } catch (err) {
      results.push({ examId, ok: false, error: errCode(err) });
    }
  }
  return { results };
}

// ─── Bộ / Part / chủ đề ───────────────────────────────────────────────────────

const CollectionInput = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
});

export async function createExamCollection(
  actorUserId: string,
  courseId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<{ collectionId: string }> {
  await assertCanEditCourse(actorUserId, courseId, db);
  const parsed = CollectionInput.safeParse(rawInput);
  if (!parsed.success) throw new ExamError("validation_failed", parsed.error.flatten());
  const last = await db.examCollection.aggregate({ where: { courseId }, _max: { orderIndex: true } });
  const c = await db.examCollection.create({
    data: { courseId, title: parsed.data.title, description: parsed.data.description ?? null, orderIndex: (last._max.orderIndex ?? -1) + 1 },
    select: { id: true },
  });
  return { collectionId: c.id };
}

async function loadCollection(actorUserId: string, collectionId: string, db: PrismaClient) {
  const c = await db.examCollection.findUnique({ where: { id: collectionId }, select: { id: true, courseId: true } });
  if (!c) throw new ExamError("collection_not_found");
  await assertCanEditCourse(actorUserId, c.courseId, db);
  return c;
}

export async function updateExamCollection(
  actorUserId: string,
  collectionId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<void> {
  await loadCollection(actorUserId, collectionId, db);
  const parsed = CollectionInput.partial().safeParse(rawInput);
  if (!parsed.success) throw new ExamError("validation_failed", parsed.error.flatten());
  await db.examCollection.update({
    where: { id: collectionId },
    data: {
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
    },
  });
}

export async function reorderExamCollections(
  actorUserId: string,
  courseId: string,
  orderedIds: string[],
  db: PrismaClient = prisma,
): Promise<void> {
  await assertCanEditCourse(actorUserId, courseId, db);
  const mine = await db.examCollection.findMany({ where: { courseId }, select: { id: true } });
  const mineSet = new Set(mine.map((c) => c.id));
  if (orderedIds.some((id) => !mineSet.has(id))) throw new ExamError("collection_not_found");
  const rest = mine.map((c) => c.id).filter((id) => !orderedIds.includes(id));
  await db.$transaction([...orderedIds, ...rest].map((id, i) => db.examCollection.update({ where: { id }, data: { orderIndex: i } })));
}

export async function deleteExamCollection(actorUserId: string, collectionId: string, db: PrismaClient = prisma): Promise<void> {
  await loadCollection(actorUserId, collectionId, db);
  // FK SetNull: các đề của bộ về "chưa thuộc bộ nào", KHÔNG bị xoá.
  await db.examCollection.delete({ where: { id: collectionId } });
}

export async function listExamCollections(actorUserId: string, courseId: string, db: PrismaClient = prisma) {
  await assertCanEditCourse(actorUserId, courseId, db);
  const rows = await db.examCollection.findMany({
    where: { courseId },
    orderBy: { orderIndex: "asc" },
    select: { id: true, title: true, description: true, orderIndex: true, _count: { select: { exams: true } } },
  });
  return rows.map((r) => ({ id: r.id, title: r.title, description: r.description, orderIndex: r.orderIndex, examCount: r._count.exams }));
}
