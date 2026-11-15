import { isTtsProviderError } from "@feedbackme/core-feedback";
import { getOpenaiClient } from "@/lib/openaiClient";
import { resolveTextToSpeech } from "@/lib/speechProvider";
import type { PartnerSpeech } from "@/lib/freeChatView";

/**
 * Đọc thành tiếng MỘT lời của bạn ảo (≤ 300 ký tự, văn bản do máy chủ tự có: lời mở đầu trong cấu hình hoặc câu bạn ảo vừa sinh — không bao giờ
 * nhận chữ từ trình duyệt để đọc). Giọng chọn theo ngôn ngữ của khoá (`speechProvider`). Lỗi đọc là lỗi MỀM: trả null để học viên vẫn có chữ
 * (như vấn đáp bằng giọng nói), chỉ ghi log. TTS không trừ ví token (độ dài bị chặn ở 300 ký tự mỗi lượt).
 */
export async function speakPartnerLine(text: string, language: string | null): Promise<PartnerSpeech | null> {
  const line = text.trim().slice(0, 300);
  if (!line) return null;
  try {
    const openai = await getOpenaiClient({ needsOpenaiKey: true });
    const tts = await (await resolveTextToSpeech(openai, language ?? "en"))(line);
    return { audioChunks: tts.audioChunks.map((b) => b.toString("base64")), contentType: tts.contentType };
  } catch (e) {
    if (!isTtsProviderError(e)) console.warn("[freechat] không đọc được lời bạn ảo:", (e as Error).message);
    else console.warn("[freechat] TTS thất bại, trả chữ không kèm tiếng:", (e as { details?: unknown }).details ?? e);
    return null;
  }
}
