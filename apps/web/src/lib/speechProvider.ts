import OpenAI from "openai";
import { neuTextToSpeech, openAiTextToSpeech, type TextToSpeechFn } from "@feedbackme/core-feedback";
import { getIntegrationSecret, IntegrationError } from "@feedbackme/core-lms";

async function optionalSecret(key: string): Promise<string | null> {
  return getIntegrationSecret(key).catch((e) => {
    if (e instanceof IntegrationError && e.code === "key_not_found") return null;
    throw e;
  });
}

/**
 * Chọn bộ đọc thành tiếng cho luồng vấn đáp. Có `neutts.base_url` thì dùng NEU
 * TTS qua Kong; không có thì rơi về OpenAI TTS (cùng key OpenAI của phần chat).
 * STT vẫn là Whisper — NEU TTS không có endpoint nhận dạng giọng nói.
 */
export async function resolveTextToSpeech(openai: OpenAI): Promise<TextToSpeechFn> {
  const baseUrl = await optionalSecret("neutts.base_url");
  if (!baseUrl) return openAiTextToSpeech(openai);

  const apiKey = await getIntegrationSecret("neutts.api_key");
  const voice = await optionalSecret("neutts.voice");
  return neuTextToSpeech({ baseUrl, apiKey, voice: voice ?? undefined });
}
