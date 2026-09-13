import OpenAI from "openai";
import { embedMaterial, openAiEmbedCompute } from "@feedbackme/core-feedback";
import { getIntegrationSecret } from "@feedbackme/core-lms";

/**
 * A6.2 — Best-effort embed ngay sau khi tạo/re-embed material. Không bao giờ
 * throw: thiếu OpenAI key, hết trần token, hay OpenAI lỗi đều chỉ trả về
 * `false` — cùng triết lý với "extractedText để trống chứ không chặn upload"
 * ở A6.1. Route gọi hàm này set cờ `embedded` trong response để GV biết cần
 * bấm re-embed hay không.
 */
export async function tryEmbedMaterial(userId: string, materialId: string): Promise<boolean> {
  try {
    const openaiKey = await getIntegrationSecret("openai");
    const openai = new OpenAI({ apiKey: openaiKey });
    const r = await embedMaterial(userId, materialId, openAiEmbedCompute(openai));
    return !r.skipped;
  } catch {
    return false;
  }
}
