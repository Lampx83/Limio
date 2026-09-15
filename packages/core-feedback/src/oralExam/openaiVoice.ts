import OpenAI, { toFile } from "openai";
import { splitForTts, type SpeechToTextFn, type TextToSpeechFn } from "./vbee";

/**
 * A6.6 (test tạm) — Cùng interface SpeechToTextFn/TextToSpeechFn với Vbee
 * (vbee.ts), để route voice-turn đổi qua lại được không phải sửa gì khác.
 * Dùng khi chưa muốn trả phí thuê bao Vbee 1 năm chỉ để thử luồng vấn đáp
 * giọng nói — key OpenAI đã có sẵn cho phần chat, trả theo lượt dùng. Giọng
 * không chuyên biệt tiếng Việt bằng Vbee, chỉ để test luồng chạy được.
 */

// Giới hạn thật của OpenAI TTS là 4096 ký tự/request — chừa biên an toàn.
export const OPENAI_TTS_MAX_CHARS = 4000;

export class OpenAiVoiceError extends Error {
  constructor(
    public readonly code: "tts_failed" | "stt_failed",
    public readonly details?: unknown,
  ) {
    super(code);
  }
}

function extFromMime(mimeType: string): string {
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  return "wav";
}

/** Nhận toàn bộ câu trả lời của AI (chữ), trả về audio đã tổng hợp qua OpenAI TTS. */
export function openAiTextToSpeech(
  openai: OpenAI,
  voice: string = "alloy",
): TextToSpeechFn {
  return async (text: string) => {
    const segments = splitForTts(text, OPENAI_TTS_MAX_CHARS);
    const audioChunks: Buffer[] = [];
    for (const segment of segments) {
      try {
        const res = await openai.audio.speech.create({
          model: "tts-1",
          voice,
          input: segment,
          response_format: "mp3",
        });
        audioChunks.push(Buffer.from(await res.arrayBuffer()));
      } catch (e) {
        throw new OpenAiVoiceError("tts_failed", e);
      }
    }
    return { audioChunks, contentType: "audio/mpeg" };
  };
}

/** Nhận file ghi âm câu trả lời của SV, trả về bản chữ qua OpenAI Whisper. */
export function openAiSpeechToText(openai: OpenAI): SpeechToTextFn {
  return async (audio: Buffer, mimeType: string) => {
    try {
      const file = await toFile(audio, `answer.${extFromMime(mimeType)}`, {
        type: mimeType,
      });
      const result = await openai.audio.transcriptions.create({
        file,
        model: "whisper-1",
        language: "vi",
      });
      return { transcript: result.text ?? "" };
    } catch (e) {
      throw new OpenAiVoiceError("stt_failed", e);
    }
  };
}
