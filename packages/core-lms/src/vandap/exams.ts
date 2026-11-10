import { z } from "zod";
import { prisma, type PrismaClient, type VanDapExam } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { emitEvent } from "../learning/events";
import { loadEditableVanDapExam } from "./access";
import { buildQuestionMap, type QuestionMap } from "./questionMap";
import { VAN_DAP_LIMITS, VanDapError } from "./types";

const Language = z.enum(["vi", "en", "zh"]);
const Title = z.string().trim().min(1).max(VAN_DAP_LIMITS.titleMax);
const Duration = z.number().int().min(VAN_DAP_LIMITS.durationMin).max(VAN_DAP_LIMITS.durationMax);

const CreateInput = z.object({
  title: Title,
  language: Language.default("vi"),
  durationMin: Duration.default(15),
  courseId: z.string().uuid().nullish(),
});
export type CreateVanDapExamInput = z.input<typeof CreateInput>;

const UpdateInput = z
  .object({
    title: Title,
    language: Language,
    durationMin: Duration,
    /** Chuỗi rỗng = xoá. */
    toneNote: z.string().trim().max(VAN_DAP_LIMITS.toneNoteMax),
    rubricText: z.string().trim().max(VAN_DAP_LIMITS.rubricMax),
  })
  .partial();
export type UpdateVanDapExamInput = z.input<typeof UpdateInput>;

/** Trường nào còn sửa được sau khi xuất bản (AC1.10): chỉ rubric (chấm thế nào) và giọng điệu (hỏi thế nào). */
const EDITABLE_AFTER_PUBLISH = new Set(["toneNote", "rubricText"]);

export async function createVanDapExam(
  actorUserId: string,
  input: CreateVanDapExamInput,
  db: PrismaClient = prisma,
): Promise<{ examId: string }> {
  const parsed = CreateInput.safeParse(input);
  if (!parsed.success) throw new VanDapError("validation_failed", parsed.error.flatten());
  const d = parsed.data;
  if (d.courseId) {
    // Gắn khoá thì phải sửa được khoá đó; không thì người này tạo được đề "trong" khoá của người khác.
    const { assertCanEditCourse, CourseAuthzError } = await import("../courses/authz");
    try {
      await assertCanEditCourse(actorUserId, d.courseId, db);
    } catch (e) {
      if (e instanceof CourseAuthzError) throw new VanDapError("forbidden");
      throw e;
    }
  }
  const exam = await db.vanDapExam.create({
    data: {
      title: d.title,
      language: d.language,
      durationMin: d.durationMin,
      courseId: d.courseId ?? null,
      createdById: actorUserId,
    },
    select: { id: true },
  });
  await emitEvent(actorUserId, LearningEventType.VanDapExamCreated, { examId: exam.id }, { courseId: d.courseId ?? null }, db);
  return { examId: exam.id };
}

export interface VanDapExamListRow {
  id: string;
  title: string;
  status: VanDapExam["status"];
  durationMin: number;
  language: VanDapExam["language"];
  importedFromExamId: string | null;
  items: number;
  scenarios: number;
  updatedAt: Date;
}

/** Đề của người này: do họ tạo, hoặc thuộc khoá họ sửa được. */
export async function listVanDapExams(actorUserId: string, db: PrismaClient = prisma): Promise<VanDapExamListRow[]> {
  const rows = await db.vanDapExam.findMany({
    where: {
      status: { not: "archived" },
      OR: [{ createdById: actorUserId }, { course: { instructors: { some: { userId: actorUserId } } } }],
    },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { items: true, scenarios: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    durationMin: r.durationMin,
    language: r.language,
    importedFromExamId: r.importedFromExamId,
    items: r._count.items,
    scenarios: r._count.scenarios,
    updatedAt: r.updatedAt,
  }));
}

export interface VanDapExamDetail {
  exam: VanDapExam;
  materials: Array<{
    id: string;
    title: string;
    mimeType: string | null;
    sizeBytes: number | null;
    chars: number;
    orderIndex: number;
  }>;
  items: Awaited<ReturnType<PrismaClient["vanDapItem"]["findMany"]>>;
  scenarios: Awaited<ReturnType<PrismaClient["vanDapScenario"]["findMany"]>>;
  questionMap: QuestionMap;
}

/** Toàn bộ màn soạn đề. CHỈ người sửa được đề mới đọc — có đáp án mong đợi và đoạn nguồn. */
export async function getVanDapExamForEditor(
  actorUserId: string,
  examId: string,
  db: PrismaClient = prisma,
): Promise<VanDapExamDetail> {
  const exam = await loadEditableVanDapExam(actorUserId, examId, db);
  const [materials, items, scenarios] = await Promise.all([
    db.vanDapMaterial.findMany({
      where: { examId },
      orderBy: { orderIndex: "asc" },
      select: { id: true, title: true, mimeType: true, sizeBytes: true, extractedText: true, orderIndex: true },
    }),
    db.vanDapItem.findMany({ where: { examId }, orderBy: { orderIndex: "asc" } }),
    db.vanDapScenario.findMany({ where: { examId }, orderBy: { orderIndex: "asc" } }),
  ]);
  return {
    exam,
    materials: materials.map(({ extractedText, ...m }) => ({ ...m, chars: extractedText.length })),
    items,
    scenarios,
    questionMap: buildQuestionMap({
      items,
      scenarios: scenarios.map((s) => ({ id: s.id, title: s.title })),
      durationMin: exam.durationMin,
    }),
  };
}

export async function updateVanDapExam(
  actorUserId: string,
  examId: string,
  input: UpdateVanDapExamInput,
  db: PrismaClient = prisma,
): Promise<void> {
  const exam = await loadEditableVanDapExam(actorUserId, examId, db);
  const parsed = UpdateInput.safeParse(input);
  if (!parsed.success) throw new VanDapError("validation_failed", parsed.error.flatten());
  const d = parsed.data;
  const fields = Object.keys(d).filter((k) => (d as Record<string, unknown>)[k] !== undefined);
  if (fields.length === 0) return;
  if (exam.status !== "draft" && fields.some((f) => !EDITABLE_AFTER_PUBLISH.has(f))) {
    throw new VanDapError("exam_locked");
  }
  await db.vanDapExam.update({
    where: { id: examId },
    data: {
      title: d.title,
      language: d.language,
      durationMin: d.durationMin,
      toneNote: d.toneNote === undefined ? undefined : d.toneNote || null,
      rubricText: d.rubricText === undefined ? undefined : d.rubricText || null,
    },
  });
  await emitEvent(actorUserId, LearningEventType.VanDapExamUpdated, { examId, fields }, { courseId: exam.courseId }, db);
}

/** AC1.9: dàn chưa có ý nào thì không xuất bản. */
export async function publishVanDapExam(actorUserId: string, examId: string, db: PrismaClient = prisma): Promise<void> {
  const exam = await loadEditableVanDapExam(actorUserId, examId, db);
  if (exam.status === "published") return;
  if (exam.status !== "draft") throw new VanDapError("exam_locked");
  const [items, scenarios] = await Promise.all([
    db.vanDapItem.count({ where: { examId } }),
    db.vanDapScenario.count({ where: { examId } }),
  ]);
  if (items === 0) throw new VanDapError("plan_empty");
  await db.vanDapExam.update({ where: { id: examId }, data: { status: "published", publishedAt: new Date() } });
  await emitEvent(actorUserId, LearningEventType.VanDapExamPublished, { examId, items, scenarios }, { courseId: exam.courseId }, db);
}

/** Chỉ xoá đề nháp. Đề đã xuất bản có thể đã có buổi/bài làm gắn vào. */
export async function deleteVanDapExam(actorUserId: string, examId: string, db: PrismaClient = prisma): Promise<void> {
  const exam = await loadEditableVanDapExam(actorUserId, examId, db);
  if (exam.status !== "draft") throw new VanDapError("exam_locked");
  await db.vanDapExam.delete({ where: { id: examId } });
  await emitEvent(actorUserId, LearningEventType.VanDapExamDeleted, { examId }, { courseId: exam.courseId }, db);
}
