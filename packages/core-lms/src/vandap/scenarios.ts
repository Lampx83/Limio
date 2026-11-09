import { z } from "zod";
import { prisma, type PrismaClient, type VanDapScenario } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { emitEvent } from "../learning/events";
import { loadDraftVanDapExam, loadEditableVanDapExam } from "./access";
import { VAN_DAP_LIMITS, VanDapError } from "./types";

// Kịch bản: HỎI TRONG BỐI CẢNH NÀO. Dùng chung một dàn; không có dàn riêng (AC1.8).

const ScenarioInput = z.object({
  title: z.string().trim().min(1).max(VAN_DAP_LIMITS.scenarioTitleMax),
  /** Bối cảnh cho AI — không gửi cho học viên. */
  aiContext: z.string().trim().min(1).max(VAN_DAP_LIMITS.scenarioAiContextMax),
  /** Thẻ "Tình huống của bạn" — phần học viên được đọc. Rỗng = không có thẻ. */
  studentBrief: z
    .string()
    .trim()
    .max(VAN_DAP_LIMITS.scenarioStudentBriefMax)
    .optional()
    .transform((v) => (v ? v : null)),
});
export type VanDapScenarioInput = z.input<typeof ScenarioInput>;

function parseScenario(input: unknown) {
  const p = ScenarioInput.safeParse(input);
  if (!p.success) throw new VanDapError("validation_failed", p.error.flatten());
  return p.data;
}

export async function listVanDapScenarios(actorUserId: string, examId: string, db: PrismaClient = prisma): Promise<VanDapScenario[]> {
  await loadEditableVanDapExam(actorUserId, examId, db);
  return db.vanDapScenario.findMany({ where: { examId }, orderBy: { orderIndex: "asc" } });
}

export async function createVanDapScenario(
  actorUserId: string,
  examId: string,
  input: VanDapScenarioInput,
  db: PrismaClient = prisma,
): Promise<{ scenarioId: string }> {
  const exam = await loadDraftVanDapExam(actorUserId, examId, db);
  const d = parseScenario(input);
  const count = await db.vanDapScenario.count({ where: { examId } });
  if (count >= VAN_DAP_LIMITS.maxScenarios) throw new VanDapError("too_many", { max: VAN_DAP_LIMITS.maxScenarios });
  const row = await db.vanDapScenario.create({ data: { ...d, examId, orderIndex: count }, select: { id: true } });
  await emitEvent(actorUserId, LearningEventType.VanDapScenarioEdited, { examId, op: "created", scenarioId: row.id }, { courseId: exam.courseId }, db);
  return { scenarioId: row.id };
}

export async function updateVanDapScenario(
  actorUserId: string,
  examId: string,
  scenarioId: string,
  input: Partial<VanDapScenarioInput>,
  db: PrismaClient = prisma,
): Promise<void> {
  const exam = await loadDraftVanDapExam(actorUserId, examId, db);
  const cur = await db.vanDapScenario.findFirst({ where: { id: scenarioId, examId } });
  if (!cur) throw new VanDapError("not_found");
  const d = parseScenario({ title: cur.title, aiContext: cur.aiContext, studentBrief: cur.studentBrief ?? undefined, ...input });
  await db.vanDapScenario.update({ where: { id: scenarioId }, data: d });
  await emitEvent(actorUserId, LearningEventType.VanDapScenarioEdited, { examId, op: "updated", scenarioId }, { courseId: exam.courseId }, db);
}

export async function deleteVanDapScenario(
  actorUserId: string,
  examId: string,
  scenarioId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const exam = await loadDraftVanDapExam(actorUserId, examId, db);
  const cur = await db.vanDapScenario.findFirst({ where: { id: scenarioId, examId }, select: { id: true } });
  if (!cur) throw new VanDapError("not_found");
  await db.vanDapScenario.delete({ where: { id: scenarioId } });
  const rest = await db.vanDapScenario.findMany({ where: { examId }, orderBy: { orderIndex: "asc" }, select: { id: true } });
  await db.$transaction(rest.map((r, i) => db.vanDapScenario.update({ where: { id: r.id }, data: { orderIndex: i } })));
  await emitEvent(actorUserId, LearningEventType.VanDapScenarioEdited, { examId, op: "deleted", scenarioId }, { courseId: exam.courseId }, db);
}
