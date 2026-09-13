import type OpenAI from "openai";

// A6.2 — model embedding rẻ nhất OpenAI, 1536 chiều (khớp cột
// OralExamMaterialChunk.embedding vector(1536) trong schema).
export const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";

export interface EmbedComputeResult {
  embeddings: number[][];
  /** Tổng token tiêu tốn — dùng để ghi AiUsageLog. */
  tokensUsed: number;
}

/** Nhận N đoạn text, trả N vector cùng thứ tự. Không tự trim/chunk — caller lo. */
export type EmbedComputeFn = (texts: string[]) => Promise<EmbedComputeResult>;

/**
 * Adapter thật gọi OpenAI. Tách khỏi embedMaterial() (materialEmbeddings.ts)
 * để phần lưu-trữ/DB test được bằng compute fn giả, không cần gọi OpenAI thật
 * trong test (tốn tiền, cần key) — giống tinh thần `openai: OpenAI` được
 * inject vào runChatTurn() ở aiTutor.ts.
 */
export function openAiEmbedCompute(
  openai: OpenAI,
  model: string = DEFAULT_EMBEDDING_MODEL,
): EmbedComputeFn {
  return async (texts: string[]) => {
    const res = await openai.embeddings.create({ model, input: texts });
    return {
      embeddings: res.data.map((d) => d.embedding),
      tokensUsed: res.usage?.total_tokens ?? 0,
    };
  };
}
