import { describe, expect, it, vi } from "vitest";
import type OpenAI from "openai";
import { openAiSpeechToText, openAiTextToSpeech } from "../oralExam/openaiVoice";

// A6.6 (test tạm) — chỉ test phần thuần của adapter (chunking, mapping lỗi,
// gọi đúng model/tham số) bằng OpenAI client giả — không gọi API thật.

function fakeOpenAI(overrides: {
  speech?: (...args: unknown[]) => unknown;
  transcriptions?: (...args: unknown[]) => unknown;
}): OpenAI {
  return {
    audio: {
      speech: { create: overrides.speech ?? vi.fn() },
      transcriptions: { create: overrides.transcriptions ?? vi.fn() },
    },
  } as unknown as OpenAI;
}

describe("openAiTextToSpeech", () => {
  it("splits long text into <=4000-char segments, one speech.create call each", async () => {
    const longText = "a".repeat(9000); // không dấu câu/khoảng trắng — buộc cắt cứng theo maxChars.
    const create = vi
      .fn()
      .mockResolvedValue({ arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer });
    const openai = fakeOpenAI({ speech: create });

    const result = await openAiTextToSpeech(openai)(longText);

    expect(create).toHaveBeenCalledTimes(3);
    expect(result.audioChunks).toHaveLength(3);
    expect(result.contentType).toBe("audio/mpeg");
    for (const call of create.mock.calls) {
      expect((call[0] as { model: string }).model).toBe("tts-1");
    }
  });

  it("wraps a thrown error as OpenAiVoiceError with code tts_failed", async () => {
    const create = vi.fn().mockRejectedValue(new Error("boom"));
    const openai = fakeOpenAI({ speech: create });

    await expect(openAiTextToSpeech(openai)("xin chào")).rejects.toMatchObject({
      code: "tts_failed",
    });
  });
});

describe("openAiSpeechToText", () => {
  it("returns the transcript text from the API response, calling whisper-1 with language=vi", async () => {
    const create = vi.fn().mockResolvedValue({ text: "xin chào thầy" });
    const openai = fakeOpenAI({ transcriptions: create });

    const result = await openAiSpeechToText(openai)(Buffer.from("fake-audio"), "audio/webm");

    expect(result.transcript).toBe("xin chào thầy");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ model: "whisper-1", language: "vi" }),
    );
  });

  it("wraps a thrown error as OpenAiVoiceError with code stt_failed", async () => {
    const create = vi.fn().mockRejectedValue(new Error("boom"));
    const openai = fakeOpenAI({ transcriptions: create });

    await expect(
      openAiSpeechToText(openai)(Buffer.from("x"), "audio/wav"),
    ).rejects.toMatchObject({ code: "stt_failed" });
  });
});
