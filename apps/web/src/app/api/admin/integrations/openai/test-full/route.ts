import { NextResponse } from "next/server";
import { DEFAULT_EMBEDDING_MODEL, isSelfHostedChat } from "@feedbackme/core-feedback";
import { getIntegrationSecret, IntegrationError, isAdmin } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";
import { createOpenaiClient, getChatOnlyApiKey } from "@/lib/openaiClient";
import {
  runAiCapabilityChecks,
  summarizeAiChecks,
  type AiCapabilityClient,
} from "@/lib/aiCapabilityCheck";

export const runtime = "nodejs";
// Bốn lời gọi chạy song song, mỗi cái tối đa 25s.
export const maxDuration = 60;

/**
 * "Test đầy đủ" cho AI: thử thật chat, embeddings, Whisper và TTS (xem aiCapabilityCheck.ts). Hai chế độ
 * như nút test cũ:
 *   - body { value: "sk-..." } — thử key đang gõ, trước khi lưu
 *   - body rỗng — thử key đã lưu
 * Chat luôn đi đúng đường production (LLM tự host nếu đã đặt LLM_BASE_URL), nên key OpenAI đang thử
 * không ảnh hưởng kết quả chat. Chưa có key OpenAI thì chỉ chat được thử, ba khả năng còn lại báo "bỏ qua".
 * Tốn dưới 0,001 USD mỗi lần bấm.
 */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isAdmin(userId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = ((await readJson(req)) ?? {}) as { value?: string };
  let openaiKey: string | null = body.value?.trim() || null;
  if (!openaiKey) {
    try {
      openaiKey = await getIntegrationSecret("openai");
    } catch (e) {
      if (!(e instanceof IntegrationError && e.code === "key_not_found")) throw e;
    }
  }

  // Key chat: key OpenAI nếu chat vẫn đi OpenAI; key giả khi chat tự host. Không có gì ⇒ bỏ qua chat.
  let chatKey: string | null = openaiKey;
  if (!chatKey) {
    try {
      chatKey = await getChatOnlyApiKey();
    } catch (e) {
      if (!(e instanceof IntegrationError && e.code === "key_not_found")) throw e;
    }
  }

  const selfHosted = isSelfHostedChat();
  const results = await runAiCapabilityChecks({
    chat: chatKey ? (createOpenaiClient(chatKey) as unknown as AiCapabilityClient) : null,
    openai: openaiKey ? (createOpenaiClient(openaiKey) as unknown as AiCapabilityClient) : null,
    chatBackend: selfHosted ? "self-hosted" : "openai",
    embeddingModel: DEFAULT_EMBEDDING_MODEL,
  });

  return NextResponse.json({ results, summary: summarizeAiChecks(results) });
}
