import { prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { emitEvent } from "../learning/events";
import { loadDraftVanDapExam, loadEditableVanDapExam } from "./access";
import { VAN_DAP_LIMITS, VanDapError } from "./types";

export interface AddVanDapMaterialInput {
  title: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  s3Key?: string | null;
  /** Chữ đã trích. Null/rỗng = tệp không đọc được chữ → từ chối ngay, không im lặng (AC1.2). */
  extractedText: string | null;
}

export async function addVanDapMaterial(
  actorUserId: string,
  examId: string,
  input: AddVanDapMaterialInput,
  db: PrismaClient = prisma,
): Promise<{ materialId: string; chars: number }> {
  const exam = await loadDraftVanDapExam(actorUserId, examId, db);
  const title = input.title.trim();
  if (title.length === 0 || title.length > VAN_DAP_LIMITS.titleMax) throw new VanDapError("validation_failed", "title");
  const text = input.extractedText?.trim() ?? "";
  if (text.length === 0) throw new VanDapError("material_unreadable");
  if (text.length > VAN_DAP_LIMITS.materialMaxChars) {
    throw new VanDapError("text_too_long", { maxChars: VAN_DAP_LIMITS.materialMaxChars });
  }
  const count = await db.vanDapMaterial.count({ where: { examId } });
  if (count >= VAN_DAP_LIMITS.maxMaterials) throw new VanDapError("too_many", { max: VAN_DAP_LIMITS.maxMaterials });
  const row = await db.vanDapMaterial.create({
    data: {
      examId,
      title,
      mimeType: input.mimeType ?? null,
      sizeBytes: input.sizeBytes ?? null,
      s3Key: input.s3Key ?? null,
      extractedText: text,
      orderIndex: count,
      uploadedById: actorUserId,
    },
    select: { id: true },
  });
  await emitEvent(
    actorUserId,
    LearningEventType.VanDapMaterialAdded,
    { examId, materialId: row.id, chars: text.length },
    { courseId: exam.courseId },
    db,
  );
  return { materialId: row.id, chars: text.length };
}

export async function removeVanDapMaterial(
  actorUserId: string,
  examId: string,
  materialId: string,
  db: PrismaClient = prisma,
): Promise<{ s3Key: string | null }> {
  const exam = await loadDraftVanDapExam(actorUserId, examId, db);
  const m = await db.vanDapMaterial.findFirst({ where: { id: materialId, examId }, select: { id: true, s3Key: true } });
  if (!m) throw new VanDapError("not_found");
  await db.vanDapMaterial.delete({ where: { id: m.id } });
  await reindexMaterials(examId, db);
  await emitEvent(actorUserId, LearningEventType.VanDapMaterialRemoved, { examId, materialId }, { courseId: exam.courseId }, db);
  return { s3Key: m.s3Key };
}

async function reindexMaterials(examId: string, db: PrismaClient) {
  const rest = await db.vanDapMaterial.findMany({ where: { examId }, orderBy: { orderIndex: "asc" }, select: { id: true } });
  await db.$transaction(rest.map((r, i) => db.vanDapMaterial.update({ where: { id: r.id }, data: { orderIndex: i } })));
}

/** Chữ đầy đủ của mọi tài liệu — chỉ cho bước "Tạo dàn từ tài liệu". Không bao giờ trả cho học viên. */
export async function getVanDapMaterialTexts(
  actorUserId: string,
  examId: string,
  db: PrismaClient = prisma,
): Promise<Array<{ id: string; title: string; text: string }>> {
  await loadEditableVanDapExam(actorUserId, examId, db);
  const rows = await db.vanDapMaterial.findMany({
    where: { examId },
    orderBy: { orderIndex: "asc" },
    select: { id: true, title: true, extractedText: true },
  });
  return rows.map((r) => ({ id: r.id, title: r.title, text: r.extractedText }));
}
