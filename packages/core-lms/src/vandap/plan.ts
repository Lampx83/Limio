import { z } from "zod";
import { prisma, type PrismaClient, type VanDapItem } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { emitEvent } from "../learning/events";
import { loadDraftVanDapExam } from "./access";
import { VAN_DAP_LIMITS, VanDapError } from "./types";

// Dàn câu hỏi: HỎI GÌ, THỨ TỰ NÀO. orderIndex là thứ tự ưu tiên khi hỏi (AC1.6).
// Mọi thao tác chỉ làm được khi đề còn nháp (AC1.10).

const ItemInput = z.object({
  core: z.string().trim().min(1).max(VAN_DAP_LIMITS.coreMax),
  sourceExcerpt: z.string().trim().max(VAN_DAP_LIMITS.excerptMax).default(""),
  level: z.enum(["basic", "intermediate", "advanced"]).default("intermediate"),
  expectedAnswer: z.string().trim().max(VAN_DAP_LIMITS.expectedAnswerMax).default(""),
  maxFollowUps: z.number().int().min(0).max(VAN_DAP_LIMITS.maxFollowUpsLimit).default(VAN_DAP_LIMITS.defaultFollowUps),
});
export type VanDapItemInput = z.input<typeof ItemInput>;

function parseItem(input: unknown) {
  const p = ItemInput.safeParse(input);
  if (!p.success) throw new VanDapError("validation_failed", p.error.flatten());
  return p.data;
}

export async function listVanDapItems(actorUserId: string, examId: string, db: PrismaClient = prisma): Promise<VanDapItem[]> {
  // Đọc dàn cũng cần đúng quyền sửa đề (có đáp án mong đợi) — dùng loader chung nhưng không đòi còn nháp.
  const { loadEditableVanDapExam } = await import("./access");
  await loadEditableVanDapExam(actorUserId, examId, db);
  return db.vanDapItem.findMany({ where: { examId }, orderBy: { orderIndex: "asc" } });
}

/** Thay TOÀN BỘ dàn (kết quả "Tạo dàn từ tài liệu"). Tất cả hoặc không gì cả — không để dàn nửa vời (AC1.5). */
export async function replaceVanDapPlan(
  actorUserId: string,
  examId: string,
  items: VanDapItemInput[],
  meta: { parts: number },
  db: PrismaClient = prisma,
): Promise<{ items: number }> {
  const exam = await loadDraftVanDapExam(actorUserId, examId, db);
  if (items.length === 0 || items.length > VAN_DAP_LIMITS.maxItems) {
    throw new VanDapError("too_many", { max: VAN_DAP_LIMITS.maxItems });
  }
  const parsed = items.map(parseItem);
  await db.$transaction([
    db.vanDapItem.deleteMany({ where: { examId } }),
    db.vanDapItem.createMany({ data: parsed.map((it, i) => ({ ...it, examId, orderIndex: i })) }),
  ]);
  await emitEvent(
    actorUserId,
    LearningEventType.VanDapPlanGenerated,
    { examId, items: parsed.length, parts: meta.parts },
    { courseId: exam.courseId },
    db,
  );
  return { items: parsed.length };
}

export async function createVanDapItem(
  actorUserId: string,
  examId: string,
  input: VanDapItemInput,
  db: PrismaClient = prisma,
): Promise<{ itemId: string }> {
  const exam = await loadDraftVanDapExam(actorUserId, examId, db);
  const d = parseItem(input);
  const count = await db.vanDapItem.count({ where: { examId } });
  if (count >= VAN_DAP_LIMITS.maxItems) throw new VanDapError("too_many", { max: VAN_DAP_LIMITS.maxItems });
  const row = await db.vanDapItem.create({ data: { ...d, examId, orderIndex: count }, select: { id: true } });
  await emitEvent(actorUserId, LearningEventType.VanDapPlanEdited, { examId, op: "created", itemId: row.id }, { courseId: exam.courseId }, db);
  return { itemId: row.id };
}

export async function updateVanDapItem(
  actorUserId: string,
  examId: string,
  itemId: string,
  input: Partial<VanDapItemInput>,
  db: PrismaClient = prisma,
): Promise<void> {
  const exam = await loadDraftVanDapExam(actorUserId, examId, db);
  const cur = await db.vanDapItem.findFirst({ where: { id: itemId, examId } });
  if (!cur) throw new VanDapError("not_found");
  const d = parseItem({ ...cur, ...input });
  await db.vanDapItem.update({
    where: { id: itemId },
    data: { core: d.core, sourceExcerpt: d.sourceExcerpt, level: d.level, expectedAnswer: d.expectedAnswer, maxFollowUps: d.maxFollowUps },
  });
  await emitEvent(actorUserId, LearningEventType.VanDapPlanEdited, { examId, op: "updated", itemId }, { courseId: exam.courseId }, db);
}

export async function deleteVanDapItem(
  actorUserId: string,
  examId: string,
  itemId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const exam = await loadDraftVanDapExam(actorUserId, examId, db);
  const cur = await db.vanDapItem.findFirst({ where: { id: itemId, examId }, select: { id: true } });
  if (!cur) throw new VanDapError("not_found");
  await db.vanDapItem.delete({ where: { id: itemId } });
  const rest = await db.vanDapItem.findMany({ where: { examId }, orderBy: { orderIndex: "asc" }, select: { id: true } });
  await db.$transaction(rest.map((r, i) => db.vanDapItem.update({ where: { id: r.id }, data: { orderIndex: i } })));
  await emitEvent(actorUserId, LearningEventType.VanDapPlanEdited, { examId, op: "deleted", itemId }, { courseId: exam.courseId }, db);
}

/** Sắp lại thứ tự ưu tiên. `orderedIds` phải là hoán vị ĐẦY ĐỦ của các ý hiện có. */
export async function reorderVanDapItems(
  actorUserId: string,
  examId: string,
  orderedIds: string[],
  db: PrismaClient = prisma,
): Promise<void> {
  const exam = await loadDraftVanDapExam(actorUserId, examId, db);
  const current = await db.vanDapItem.findMany({ where: { examId }, select: { id: true } });
  const have = new Set(current.map((c) => c.id));
  if (orderedIds.length !== have.size || new Set(orderedIds).size !== have.size || orderedIds.some((id) => !have.has(id))) {
    throw new VanDapError("not_a_permutation");
  }
  await db.$transaction(orderedIds.map((id, i) => db.vanDapItem.update({ where: { id }, data: { orderIndex: i } })));
  await emitEvent(actorUserId, LearningEventType.VanDapPlanEdited, { examId, op: "reordered" }, { courseId: exam.courseId }, db);
}
