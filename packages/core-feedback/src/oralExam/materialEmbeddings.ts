import { randomUUID } from "node:crypto";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { AiTutorError } from "../aiTutor/errors";
import { assertWithinCaps, recordAiUsage } from "../aiTutor/aiTutor";
import { chunkText } from "./chunk";
import { DEFAULT_EMBEDDING_MODEL, type EmbedComputeFn } from "./embeddings";

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

export interface EmbedMaterialResult {
  chunkCount: number;
  /** true khi extractedText null (chưa parse được ở A6.1) — không có gì để embed. */
  skipped: boolean;
}

/**
 * Cắt OralExamMaterial.extractedText thành chunk, embed từng chunk, lưu lại.
 * Idempotent: xoá sạch chunk cũ trước khi ghi chunk mới, nên gọi lại an toàn
 * (retry khi lần trước OpenAI lỗi) và không bao giờ để lẫn chunk cũ-mới.
 *
 * `compute` được inject (không tự dựng OpenAI client ở đây) để phần lưu-trữ
 * này test được bằng compute fn giả — xem embeddings.ts.
 */
export async function embedMaterial(
  actorUserId: string,
  materialId: string,
  compute: EmbedComputeFn,
  db: PrismaClient = prisma,
): Promise<EmbedMaterialResult> {
  const material = await db.oralExamMaterial.findUnique({
    where: { id: materialId },
    select: { extractedText: true, exam: { select: { id: true, courseId: true } } },
  });
  if (!material) throw new AiTutorError("material_not_found");

  const texts = material.extractedText ? chunkText(material.extractedText) : [];
  if (texts.length === 0) {
    // Chưa có text để embed (A6.1: extractedText null = parse thất bại, GV
    // cần biết để xử lý) — không phải lỗi, không tạo chunk rỗng.
    await db.oralExamMaterialChunk.deleteMany({ where: { materialId } });
    return { chunkCount: 0, skipped: true };
  }

  await assertWithinCaps(actorUserId, db, "generator");

  // Xoá chunk cũ TRƯỚC khi gọi OpenAI: nếu compute() lỗi giữa chừng, material
  // tạm thời 0 chunk (retry được) chứ không lẫn chunk cũ với chunk mới.
  await db.oralExamMaterialChunk.deleteMany({ where: { materialId } });

  let result: Awaited<ReturnType<EmbedComputeFn>>;
  try {
    result = await compute(texts);
  } catch (e) {
    throw new AiTutorError("openai_error", (e as Error).message);
  }
  if (result.embeddings.length !== texts.length) {
    throw new AiTutorError("openai_error", "embedding_count_mismatch");
  }

  for (let i = 0; i < texts.length; i++) {
    await db.$executeRaw`
      INSERT INTO "OralExamMaterialChunk" (id, "materialId", "chunkIndex", "chunkText", embedding, "createdAt")
      VALUES (${randomUUID()}, ${materialId}, ${i}, ${texts[i]}, ${toVectorLiteral(result.embeddings[i]!)}::vector, now())
    `;
  }

  await recordAiUsage(actorUserId, DEFAULT_EMBEDDING_MODEL, result.tokensUsed, 0, db);

  // B15-style — xem lý do trong aiTutor.ts: mọi lượt gọi AI phải để lại dấu
  // vết trên dòng thời gian, kể cả hành động của GV chứ không chỉ SV.
  await db.learningEvent.create({
    data: {
      userId: actorUserId,
      courseId: material.exam.courseId,
      eventType: LearningEventType.ExamOralMaterialEmbedded,
      payload: {
        examId: material.exam.id,
        materialId,
        chunkCount: texts.length,
        tokensUsed: result.tokensUsed,
      },
    },
  });

  return { chunkCount: texts.length, skipped: false };
}

export interface MaterialChunkMatch {
  id: string;
  materialId: string;
  chunkIndex: number;
  chunkText: string;
  /** 1 = giống hệt, 0 = không liên quan gì (1 - cosine distance). */
  similarity: number;
}

/**
 * Tìm top-k chunk gần nghĩa nhất với 1 vector câu hỏi, giới hạn trong phạm vi
 * 1 exam. Nhận sẵn vector (không tự gọi OpenAI embed câu hỏi ở đây) — tách
 * biệt "biến text thành vector" khỏi "tìm theo vector" để mỗi phần test độc
 * lập được (search dùng vector giả trong test, không cần OpenAI thật).
 */
export async function searchMaterialChunks(
  examId: string,
  queryEmbedding: number[],
  k: number,
  db: PrismaClient = prisma,
): Promise<MaterialChunkMatch[]> {
  const vectorLiteral = toVectorLiteral(queryEmbedding);
  return db.$queryRaw<MaterialChunkMatch[]>`
    SELECT c.id, c."materialId", c."chunkIndex", c."chunkText",
           1 - (c.embedding <=> ${vectorLiteral}::vector) AS similarity
    FROM "OralExamMaterialChunk" c
    JOIN "OralExamMaterial" m ON m.id = c."materialId"
    WHERE m."examId" = ${examId}
    ORDER BY c.embedding <=> ${vectorLiteral}::vector
    LIMIT ${k}
  `;
}
