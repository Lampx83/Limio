import OpenAI from "openai";
import {
  listNeuVoices,
  neuTextToSpeech,
  openAiTextToSpeech,
  pickNeuVoice,
  type NeuVoice,
  type TextToSpeechFn,
} from "@feedbackme/core-feedback";
import { getIntegrationSecret, IntegrationError } from "@feedbackme/core-lms";

async function optionalSecret(key: string): Promise<string | null> {
  return getIntegrationSecret(key).catch((e) => {
    if (e instanceof IntegrationError && e.code === "key_not_found") return null;
    throw e;
  });
}

// Danh sách giọng ít đổi; nhớ 10 phút để mỗi lượt vấn đáp không phải gọi thêm một request.
let voicesCache: { key: string; at: number; voices: NeuVoice[] } | null = null;
const VOICES_TTL_MS = 10 * 60_000;

async function cachedNeuVoices(baseUrl: string, apiKey: string): Promise<NeuVoice[]> {
  const key = `${baseUrl}|${apiKey}`;
  if (voicesCache && voicesCache.key === key && Date.now() - voicesCache.at < VOICES_TTL_MS) return voicesCache.voices;
  const voices = await listNeuVoices({ baseUrl, apiKey });
  voicesCache = { key, at: Date.now(), voices };
  return voices;
}

/**
 * Chọn bộ đọc thành tiếng cho luồng vấn đáp. Có `neutts.base_url` thì dùng NEU TTS qua Kong; không có thì rơi
 * về OpenAI TTS (cùng key OpenAI của phần chat). STT vẫn là Whisper — NEU TTS không có endpoint nhận dạng.
 *
 * NEU đọc được vi/en/zh nhưng GIỌNG quyết định ngôn ngữ: `neutts.voice` (mặc định giọng Việt) chỉ hợp đề tiếng
 * Việt. Đề ngôn ngữ khác thì dùng giọng admin chọn (`neutts.voice_zh`/`neutts.voice_en`); chưa chọn thì lấy giọng
 * NEU cùng ngôn ngữ đầu tiên trong danh sách; không có giọng nào thì dùng OpenAI TTS thay vì đọc sai giọng.
 */
export async function resolveTextToSpeech(openai: OpenAI, language: string = "vi"): Promise<TextToSpeechFn> {
  const baseUrl = await optionalSecret("neutts.base_url");
  if (!baseUrl) return openAiTextToSpeech(openai);

  const apiKey = await getIntegrationSecret("neutts.api_key");
  const configured = (await optionalSecret("neutts.voice")) ?? undefined;
  if (language === "vi") return neuTextToSpeech({ baseUrl, apiKey, voice: configured });

  // Giọng admin đã chọn cho ngôn ngữ này (neutts.voice_zh / neutts.voice_en) thắng; chưa chọn thì lấy theo danh sách.
  const chosen = await optionalSecret(`neutts.voice_${language}`);
  if (chosen) return neuTextToSpeech({ baseUrl, apiKey, voice: chosen });

  try {
    const voice = pickNeuVoice(await cachedNeuVoices(baseUrl, apiKey), language, configured);
    if (voice) return neuTextToSpeech({ baseUrl, apiKey, voice });
  } catch (e) {
    console.warn("[oral-exam] không lấy được danh sách giọng NEU, dùng OpenAI TTS:", (e as Error).message);
  }
  return openAiTextToSpeech(openai);
}
