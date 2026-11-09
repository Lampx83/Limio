import { prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { assertCanEditExam, CourseAuthzError } from "../courses/authz";
import { emitEvent } from "../learning/events";
import { VAN_DAP_LIMITS, VanDapError } from "./types";

/**
 * AC0.4 — "Nhập từ đề vấn đáp cũ": sao chép tài liệu, chủ đề (thành kịch bản) và rubric thành một đề MỚI ở dạng
 * nháp. Đề cũ không đổi gì. Cố ý KHÔNG gọi `assertLegacyOralEnabled`: sao chép là đọc đề cũ, phải còn dùng được sau
 * khi bản cũ đã bị tắt.
 *
 *  - Prompt cũ (`examinerInstructions`) chỉ vào `legacyPrompt` để đối chiếu (AC0.5). KHÔNG chép vào `toneNote`:
 *    nó thường chứa lệnh về thứ tự và nội dung, đúng thứ Limio Vấn đáp tách ra khỏi giọng điệu.
 *  - Tài liệu chỉ giữ phần chữ đã trích (không có tệp đứng sau). Tài liệu không có chữ (PDF scan) bị bỏ qua.
 *  - Rubric = rubric nhập tay của đề + chữ của các tài liệu loại "rubric" cũ.
 */
export async function importVanDapFromLegacyExam(
  actorUserId: string,
  legacyExamId: string,
  db: PrismaClient = prisma,
): Promise<{ examId: string; materials: number; scenarios: number; skippedMaterials: number }> {
  const legacy = await db.exam.findUnique({
    where: { id: legacyExamId },
    select: {
      id: true,
      title: true,
      kind: true,
      courseId: true,
      createdById: true,
      durationMin: true,
      language: true,
      examinerInstructions: true,
      oralRubricText: true,
    },
  });
  if (!legacy) throw new VanDapError("not_found");
  if (legacy.kind !== "oral") throw new VanDapError("legacy_not_oral");
  try {
    await assertCanEditExam(actorUserId, legacy, db);
  } catch (e) {
    if (e instanceof CourseAuthzError) throw new VanDapError("forbidden");
    throw e;
  }

  const [materials, topics] = await Promise.all([
    db.oralExamMaterial.findMany({ where: { examId: legacyExamId }, orderBy: { orderIndex: "asc" } }),
    db.oralExamTopic.findMany({ where: { examId: legacyExamId }, orderBy: { orderIndex: "asc" } }),
  ]);

  const sources = materials.filter((m) => m.type !== "rubric");
  const readable = sources.filter((m) => (m.extractedText ?? "").trim().length > 0).slice(0, VAN_DAP_LIMITS.maxMaterials);
  const rubricParts = [
    legacy.oralRubricText?.trim() ?? "",
    ...materials.filter((m) => m.type === "rubric").map((m) => (m.extractedText ?? "").trim()),
  ].filter((t) => t.length > 0);
  const rubricText = rubricParts.join("\n\n").slice(0, VAN_DAP_LIMITS.rubricMax) || null;
  const duration = Math.min(VAN_DAP_LIMITS.durationMax, Math.max(VAN_DAP_LIMITS.durationMin, legacy.durationMin));

  const created = await db.$transaction(async (tx) => {
    const exam = await tx.vanDapExam.create({
      data: {
        title: `${legacy.title} (Limio Vấn đáp)`.slice(0, VAN_DAP_LIMITS.titleMax),
        courseId: legacy.courseId,
        createdById: actorUserId,
        language: legacy.language,
        durationMin: duration,
        rubricText,
        legacyPrompt: legacy.examinerInstructions?.trim() || null,
        importedFromExamId: legacy.id,
      },
      select: { id: true },
    });
    if (readable.length > 0) {
      await tx.vanDapMaterial.createMany({
        data: readable.map((m, i) => ({
          examId: exam.id,
          title: m.title,
          mimeType: m.mimeType,
          sizeBytes: m.sizeBytes,
          extractedText: (m.extractedText ?? "").trim().slice(0, VAN_DAP_LIMITS.materialMaxChars),
          orderIndex: i,
          uploadedById: actorUserId,
        })),
      });
    }
    const scenarioRows = topics.slice(0, VAN_DAP_LIMITS.maxScenarios);
    if (scenarioRows.length > 0) {
      await tx.vanDapScenario.createMany({
        data: scenarioRows.map((t, i) => ({
          examId: exam.id,
          title: t.title.slice(0, VAN_DAP_LIMITS.scenarioTitleMax),
          aiContext: t.brief.slice(0, VAN_DAP_LIMITS.scenarioAiContextMax),
          studentBrief: t.studentBrief ? t.studentBrief.slice(0, VAN_DAP_LIMITS.scenarioStudentBriefMax) : null,
          orderIndex: i,
        })),
      });
    }
    await emitEvent(
      actorUserId,
      LearningEventType.VanDapExamImported,
      { examId: exam.id, fromExamId: legacy.id, materials: readable.length, scenarios: scenarioRows.length },
      { courseId: legacy.courseId },
      tx,
    );
    return { examId: exam.id, scenarios: scenarioRows.length };
  });

  return {
    examId: created.examId,
    materials: readable.length,
    scenarios: created.scenarios,
    skippedMaterials: sources.length - readable.length,
  };
}

export interface LegacyOralImportCandidate {
  id: string;
  title: string;
  status: string;
  materials: number;
  topics: number;
  hasPrompt: boolean;
  /** Đã có bản Limio Vấn đáp nhập từ đề này. */
  alreadyImported: boolean;
}

/** Đề vấn đáp cũ mà người này sửa được — danh sách cho mục "Nhập từ đề vấn đáp cũ". Chỉ đọc. */
export async function listLegacyOralImportCandidates(
  actorUserId: string,
  db: PrismaClient = prisma,
): Promise<LegacyOralImportCandidate[]> {
  const exams = await db.exam.findMany({
    where: {
      kind: "oral",
      OR: [{ createdById: actorUserId }, { course: { instructors: { some: { userId: actorUserId } } } }],
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      title: true,
      status: true,
      examinerInstructions: true,
      _count: { select: { oralMaterials: true, oralTopics: true } },
    },
  });
  if (exams.length === 0) return [];
  const imported = await db.vanDapExam.findMany({
    where: { importedFromExamId: { in: exams.map((e) => e.id) }, createdById: actorUserId },
    select: { importedFromExamId: true },
  });
  const done = new Set(imported.map((i) => i.importedFromExamId));
  return exams.map((e) => ({
    id: e.id,
    title: e.title,
    status: e.status,
    materials: e._count.oralMaterials,
    topics: e._count.oralTopics,
    hasPrompt: (e.examinerInstructions ?? "").trim().length > 0,
    alreadyImported: done.has(e.id),
  }));
}
