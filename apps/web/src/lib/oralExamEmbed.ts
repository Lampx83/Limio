import type OpenAI from "openai";
import { createOpenaiClient, getChatOnlyApiKey } from "@/lib/openaiClient";
import { embedMaterial, getEmbedCompute, type EmbedComputeFn } from "@feedbackme/core-feedback";
import { IntegrationError } from "@feedbackme/core-lms";

/**
 * Client + hàm embeddings cho vấn đáp bằng CHỮ.
 *
 * Cả chat lẫn embeddings đều chạy trên máy chủ tự host nên không cần OpenAI key. Chưa đặt EMBED_BASE_URL
 * ⇒ `computeEmbed = null`, lõi vấn đáp tự chuyển sang so khớp từ khoá. Chưa đặt LLM_BASE_URL (chat) ⇒ ném
 * "openai_not_configured" (không có gì để hỏi). Giọng nói (Whisper/TTS) KHÔNG đi qua đây — luôn cần key
 * OpenAI thật.
 */
export async function getOralExamTextAi(): Promise<{
  openai: OpenAI;
  computeEmbed: EmbedComputeFn | null;
}> {
  let key: string;
  try {
    key = await getChatOnlyApiKey();
  } catch (e) {
    if (e instanceof IntegrationError && e.code === "key_not_found") {
      throw new Error("openai_not_configured");
    }
    throw e;
  }
  return { openai: createOpenaiClient(key), computeEmbed: getEmbedCompute() };
}

/**
 * A6.2 — Best-effort embed ngay sau khi tạo/re-embed material. Không bao giờ
 * throw: chưa cấu hình, hết trần token, hay máy chủ embeddings lỗi đều chỉ trả về
 * `false` — cùng triết lý với "extractedText để trống chứ không chặn upload"
 * ở A6.1. Route gọi hàm này set cờ `embedded` trong response để GV biết cần
 * bấm re-embed hay không.
 *
 * Chưa đặt EMBED_BASE_URL: tài liệu vẫn được cắt đoạn và lưu (AI tìm theo từ khoá) nên vẫn trả
 * `true` — "dùng được", dù chưa có vector.
 */
export async function tryEmbedMaterial(userId: string, materialId: string): Promise<boolean> {
  try {
    const { computeEmbed } = await getOralExamTextAi();
    const r = await embedMaterial(userId, materialId, computeEmbed);
    return !r.skipped;
  } catch {
    return false;
  }
}
