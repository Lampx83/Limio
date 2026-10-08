import { randomUUID } from "node:crypto";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { AiTutorError } from "../aiTutor/errors";
import { assertWithinCaps, recordAiUsage } from "../aiTutor/aiTutor";
import { chunkText } from "./chunk";
import { DEFAULT_EMBEDDING_MODEL, type EmbedComputeFn } from "./embeddings";
import { rankChunksByKeyword } from "./keywordSearch";

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

export interface EmbedMaterialResult {
  chunkCount: number;
  /** true khi extractedText null (chưa parse được ở A6.1) — không có gì để embed. */
  skipped: boolean;
  /**
   * true khi chunk đã có vector. false khi không có compute (không OpenAI key): chunk vẫn được lưu để
   * AI tìm theo từ khoá, chỉ chưa tìm được theo nghĩa.
   */
  embedded: boolean;
}

/**
 * Cắt OralExamMaterial.extractedText thành chunk, embed từng chunk, lưu lại.
 * Idempotent: xoá sạch chunk cũ trước khi ghi chunk mới, nên gọi lại an toàn
 * (retry khi lần trước OpenAI lỗi) và không bao giờ để lẫn chunk cũ-mới.
 *
 * `compute` được inject (không tự dựng OpenAI client ở đây) để phần lưu-trữ
 * này test được bằng compute fn giả — xem embeddings.ts.
 *
 * `compute = null` (không có OpenAI key — chat chạy trên LLM tự host): vẫn cắt đoạn và lưu chunk với
 * embedding NULL, không gọi AI, không tính trần token. Vấn đáp bằng chữ khi đó chọn đoạn theo từ khoá
 * (searchMaterialChunksByKeyword). Có key sau này thì embed lại, hàm này xoá chunk cũ ghi chunk có vector.
 */
export async function embedMaterial(
  actorUserId: string,
  materialId: string,
  compute: EmbedComputeFn | null,
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
    return { chunkCount: 0, skipped: true, embedded: false };
  }

  // Không gọi AI thì không tiêu token: chỉ kiểm trần khi thật sự sẽ embed.
  if (compute) await assertWithinCaps(actorUserId, db, "generator");

  // Xoá chunk cũ TRƯỚC khi gọi OpenAI: nếu compute() lỗi giữa chừng, material
  // tạm thời 0 chunk (retry được) chứ không lẫn chunk cũ với chunk mới.
  await db.oralExamMaterialChunk.deleteMany({ where: { materialId } });

  let result: Awaited<ReturnType<EmbedComputeFn>> | null = null;
  if (compute) {
    try {
      result = await compute(texts);
    } catch (e) {
      throw new AiTutorError("openai_error", (e as Error).message, e);
    }
    if (result.embeddings.length !== texts.length) {
      throw new AiTutorError("openai_error", "embedding_count_mismatch");
    }
  }

  if (result) {
    for (let i = 0; i < texts.length; i++) {
      await db.$executeRaw`
        INSERT INTO "OralExamMaterialChunk" (id, "materialId", "chunkIndex", "chunkText", embedding, "createdAt")
        VALUES (${randomUUID()}, ${materialId}, ${i}, ${texts[i]}, ${toVectorLiteral(result.embeddings[i]!)}::vector, now())
      `;
    }
    await recordAiUsage(actorUserId, DEFAULT_EMBEDDING_MODEL, result.tokensUsed, 0, db);
  } else {
    await db.oralExamMaterialChunk.createMany({
      data: texts.map((chunkText, chunkIndex) => ({ materialId, chunkIndex, chunkText })),
    });
  }

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
        tokensUsed: result?.tokensUsed ?? 0,
        embedded: result !== null,
      },
    },
  });

  return { chunkCount: texts.length, skipped: false, embedded: result !== null };
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
    WHERE m."examId" = ${examId} AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> ${vectorLiteral}::vector
    LIMIT ${k}
  `;
}

/**
 * Phương án lùi khi không có vector (không OpenAI key, hoặc tài liệu được lưu trước khi có key): lấy
 * các đoạn của đề rồi xếp hạng theo từ khoá. Số đoạn mỗi đề nhỏ (tài liệu vấn đáp cỡ chục trang) nên
 * xếp hạng trong bộ nhớ là đủ — không cần dựng chỉ mục full-text riêng cho tiếng Việt/Trung.
 * Trả rỗng khi không từ nào trùng; `similarity` mang điểm từ khoá (không cùng thang với cosine).
 */
export async function searchMaterialChunksByKeyword(
  examId: string,
  query: string,
  k: number,
  db: PrismaClient = prisma,
): Promise<MaterialChunkMatch[]> {
  const chunks = await db.oralExamMaterialChunk.findMany({
    where: { material: { examId } },
    orderBy: [{ material: { orderIndex: "asc" } }, { chunkIndex: "asc" }],
    select: { id: true, materialId: true, chunkIndex: true, chunkText: true },
  });
  return rankChunksByKeyword(query, chunks, k).map(({ score, ...c }) => ({ ...c, similarity: score }));
}
