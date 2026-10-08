import type OpenAI from "openai";
import { createOpenaiClient, getChatOnlyApiKey } from "@/lib/openaiClient";
import {
  embedMaterial,
  isSelfHostedChat,
  openAiEmbedCompute,
  type EmbedComputeFn,
} from "@feedbackme/core-feedback";
import { getIntegrationSecret, IntegrationError } from "@feedbackme/core-lms";

/**
 * Client + hàm embeddings cho vấn đáp bằng CHỮ.
 *
 * Chat đã chạy trên LLM tự host nên không cần OpenAI key; chỉ embeddings (chọn đoạn tài liệu theo nghĩa)
 * vẫn là OpenAI. Có key ⇒ dùng vector như trước. Không key mà chat tự host ⇒ `computeEmbed = null`, lõi
 * vấn đáp tự chuyển sang so khớp từ khoá. Không key và chat vẫn đi OpenAI ⇒ ném "openai_not_configured"
 * (không có gì để hỏi). Giọng nói (Whisper/TTS) KHÔNG đi qua đây — luôn cần key thật.
 */
export async function getOralExamTextAi(): Promise<{
  openai: OpenAI;
  computeEmbed: EmbedComputeFn | null;
}> {
  let key: string | null = null;
  try {
    key = await getIntegrationSecret("openai");
  } catch (e) {
    if (!(e instanceof IntegrationError && e.code === "key_not_found")) throw e;
  }
  if (key) {
    const openai = createOpenaiClient(key);
    return { openai, computeEmbed: openAiEmbedCompute(openai) };
  }
  if (!isSelfHostedChat()) throw new Error("openai_not_configured");
  return { openai: createOpenaiClient(await getChatOnlyApiKey()), computeEmbed: null };
}

/**
 * A6.2 — Best-effort embed ngay sau khi tạo/re-embed material. Không bao giờ
 * throw: thiếu OpenAI key, hết trần token, hay OpenAI lỗi đều chỉ trả về
 * `false` — cùng triết lý với "extractedText để trống chứ không chặn upload"
 * ở A6.1. Route gọi hàm này set cờ `embedded` trong response để GV biết cần
 * bấm re-embed hay không.
 *
 * Không có key mà chat tự host: tài liệu vẫn được cắt đoạn và lưu (AI tìm theo từ khoá) nên vẫn trả
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
