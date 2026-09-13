import { z } from "zod";
import { prisma, type PrismaClient, type OralExamMaterial } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { assertCanEditCourse } from "../courses/authz";
import { emitEvent } from "../learning/events";
import { ExamError } from "./types";

// A6.1 — Vấn đáp AI. Tài liệu GV upload cho "giảng viên ảo" — KHÔNG BAO GIỜ lộ
// cho sinh viên (xem A6.3). File lưu ở storage layer `private`.

export const MATERIAL_FILE_MIME_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

// 20MB — đủ cho đề cương/tài liệu tham khảo dạng text; không phải kho video/audio.
export const MATERIAL_MAX_BYTES = 20 * 1024 * 1024;

const materialFileType = z.enum(["document", "rubric"]);

async function assertExamOralAndEditable(
  examId: string,
  actorUserId: string,
  db: PrismaClient,
) {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { courseId: true, status: true, kind: true },
  });
  if (!exam) throw new ExamError("exam_not_found");
  if (exam.kind !== "oral") throw new ExamError("exam_not_oral");
  // Cùng bất biến với ExamAsset — sửa tài liệu sau publish có thể khiến sinh
  // viên thi cùng ca gặp nội dung khác nhau tuỳ lúc AI đọc lại tài liệu.
  if (exam.status !== "draft") throw new ExamError("exam_not_draft");
  await assertCanEditCourse(actorUserId, exam.courseId, db);
  return exam;
}

const CreateFileMaterialInput = z.object({
  type: materialFileType,
  title: z.string().min(1).max(200).trim(),
  s3Key: z.string().min(1).max(500),
  mimeType: z.enum(MATERIAL_FILE_MIME_TYPES),
  sizeBytes: z.number().int().positive().max(MATERIAL_MAX_BYTES),
  // null = đã cố parse nhưng thất bại (vd PDF scan không có text layer).
  // Route gọi extractMaterialText() trước rồi truyền kết quả vào đây — core
  // không tự parse để giữ hàm này thuần và dễ test.
  extractedText: z.string().max(500_000).nullable(),
});

/** Đăng ký tài liệu dạng file (document | rubric) đã upload lên storage. */
export async function createOralMaterialDocument(
  actorUserId: string,
  examId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<{ materialId: string; extracted: boolean }> {
  await assertExamOralAndEditable(examId, actorUserId, db);
  const parsed = CreateFileMaterialInput.safeParse(rawInput);
  if (!parsed.success) throw new ExamError("validation_failed", parsed.error.flatten());
  const d = parsed.data;

  const maxOrder = await db.oralExamMaterial.aggregate({
    where: { examId },
    _max: { orderIndex: true },
  });
  const material = await db.oralExamMaterial.create({
    data: {
      examId,
      type: d.type,
      title: d.title,
      s3Key: d.s3Key,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      extractedText: d.extractedText,
      orderIndex: (maxOrder._max.orderIndex ?? -1) + 1,
      uploadedById: actorUserId,
    },
    select: { id: true },
  });
  await emitEvent(
    actorUserId,
    LearningEventType.ExamOralMaterialUploaded,
    { examId, materialId: material.id, type: d.type },
    { eventKey: `exam.oral_material.uploaded:${material.id}` },
    db,
  );
  return { materialId: material.id, extracted: d.extractedText !== null };
}

const CreateTopicListInput = z.object({
  title: z.string().min(1).max(200).trim(),
  text: z.string().min(1).max(50_000).trim(),
});

/** Đăng ký danh sách chủ đề GV gõ tay — không có file đứng sau. */
export async function createOralMaterialTopicList(
  actorUserId: string,
  examId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<{ materialId: string }> {
  await assertExamOralAndEditable(examId, actorUserId, db);
  const parsed = CreateTopicListInput.safeParse(rawInput);
  if (!parsed.success) throw new ExamError("validation_failed", parsed.error.flatten());
  const d = parsed.data;

  const maxOrder = await db.oralExamMaterial.aggregate({
    where: { examId },
    _max: { orderIndex: true },
  });
  const material = await db.oralExamMaterial.create({
    data: {
      examId,
      type: "topic_list",
      title: d.title,
      extractedText: d.text,
      orderIndex: (maxOrder._max.orderIndex ?? -1) + 1,
      uploadedById: actorUserId,
    },
    select: { id: true },
  });
  await emitEvent(
    actorUserId,
    LearningEventType.ExamOralMaterialUploaded,
    { examId, materialId: material.id, type: "topic_list" },
    { eventKey: `exam.oral_material.uploaded:${material.id}` },
    db,
  );
  return { materialId: material.id };
}

/** Danh sách tài liệu theo orderIndex. Ném exam_not_oral nếu exam là thi viết. */
export async function listOralMaterials(
  actorUserId: string,
  examId: string,
  db: PrismaClient = prisma,
): Promise<OralExamMaterial[]> {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { courseId: true, kind: true },
  });
  if (!exam) throw new ExamError("exam_not_found");
  if (exam.kind !== "oral") throw new ExamError("exam_not_oral");
  await assertCanEditCourse(actorUserId, exam.courseId, db);
  return db.oralExamMaterial.findMany({
    where: { examId },
    orderBy: { orderIndex: "asc" },
  });
}

/** Sắp lại thứ tự — orderedIds phải là hoán vị đầy đủ của tài liệu hiện có. */
export async function reorderOralMaterials(
  actorUserId: string,
  examId: string,
  orderedIds: string[],
  db: PrismaClient = prisma,
): Promise<void> {
  const exam = await assertExamOralAndEditable(examId, actorUserId, db);
  void exam;
  const existing = await db.oralExamMaterial.findMany({
    where: { examId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((m) => m.id));
  if (
    orderedIds.length !== existingIds.size ||
    !orderedIds.every((id) => existingIds.has(id))
  ) {
    throw new ExamError("validation_failed", "orderedIds_mismatch");
  }
  await db.$transaction(
    orderedIds.map((id, index) =>
      db.oralExamMaterial.update({ where: { id }, data: { orderIndex: index } }),
    ),
  );
}

/** Xoá tài liệu. Trả về record đã xoá để caller (route) dọn file trên storage. */
export async function deleteOralMaterial(
  actorUserId: string,
  materialId: string,
  db: PrismaClient = prisma,
): Promise<OralExamMaterial> {
  const material = await db.oralExamMaterial.findUnique({ where: { id: materialId } });
  if (!material) throw new ExamError("material_not_found");
  await assertExamOralAndEditable(material.examId, actorUserId, db);
  await db.oralExamMaterial.delete({ where: { id: materialId } });
  await emitEvent(
    actorUserId,
    LearningEventType.ExamOralMaterialDeleted,
    { examId: material.examId, materialId: material.id },
    { eventKey: `exam.oral_material.deleted:${material.id}` },
    db,
  );
  return material;
}
