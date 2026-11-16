import OpenAI from "openai";
import {
  listNeuVoices,
  neuTextToSpeech,
  openAiTextToSpeech,
  openAiTranscriber,
  pickNeuVoice,
  speechServiceTranscriber,
  withSpeechFallback,
  type NeuVoice,
  type TextToSpeechFn,
  type Transcriber,
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

/**
 * Bộ chuyển chữ cho MỌI đường học viên nói bằng mic (câu mở, hội thoại, đóng vai, xem thử, bài nói nộp giảng viên).
 * Đã cấu hình dịch vụ phân tích tiếng nói nội bộ (`speech_analysis.base_url` + `.api_key`) thì gọi nó trước — giọng nói ở lại máy chủ của mình, và có
 * thêm các đoạn có tiếng (VAD) để đo chỗ ngừng chính xác hơn; bận, quá giờ, mạng hay phản hồi lỗi thì tự rơi về Whisper qua OpenAI như trước.
 * Chưa cấu hình thì trả `undefined` để nơi gọi dùng đường Whisper cũ nguyên vẹn.
 *
 * Khách hàng OpenAI chỉ được tạo khi thật sự phải rơi về Whisper: dịch vụ chạy được thì thiếu cấu hình OpenAI không lộ ra.
 */
export async function resolveTranscriber(getOpenai: () => Promise<OpenAI>): Promise<Transcriber | undefined> {
  const baseUrl = await optionalSecret("speech_analysis.base_url");
  if (!baseUrl) return undefined;
  const apiKey = await optionalSecret("speech_analysis.api_key");
  if (!apiKey) {
    console.warn("[speech] đã có speech_analysis.base_url nhưng thiếu speech_analysis.api_key: dùng Whisper qua OpenAI");
    return undefined;
  }
  return withSpeechFallback(
    speechServiceTranscriber({ baseUrl, apiKey }),
    async (audio, opts) => openAiTranscriber(await getOpenai())(audio, opts),
    // Chỉ ghi MÃ lý do (busy, timeout, network, http_5xx, bad_response), không ghi chữ hay âm thanh.
    (reason) => console.warn(`[speech] dịch vụ phân tích tiếng nói không dùng được (${reason}): dùng Whisper qua OpenAI`),
  );
}
