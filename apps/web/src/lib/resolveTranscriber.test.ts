import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type OpenAI from "openai";

// docs/tieu-chi/limio-language-cham-noi-bang-mic.md AC1 — chọn bộ chuyển chữ: dịch vụ nội bộ trước, lỗi thì Whisper qua OpenAI.

const secrets = new Map<string, string>();
vi.mock("@feedbackme/core-lms", () => {
  class IntegrationError extends Error {
    constructor(public code: string, msg?: string) {
      super(msg ?? code);
    }
  }
  return {
    IntegrationError,
    getIntegrationSecret: async (key: string) => {
      const v = secrets.get(key);
      if (v === undefined) throw new IntegrationError("key_not_found", key);
      return v;
    },
  };
});

import { resolveTranscriber } from "./speechProvider";

const audio = { buffer: Buffer.from([1, 2, 3]), mimeType: "audio/webm" };
const SERVICE_OK = {
  version: "1",
  engine: { name: "faster-whisper", model: "large-v3", version: "1.0.3" },
  language: "en",
  durationSec: 5,
  text: "from the service",
  words: [{ word: "from", start: 0.2, end: 0.5 }],
  speechSegments: [{ start: 0.2, end: 4.5 }],
};

function fakeOpenai(calls: { n: number }) {
  return {
    audio: {
      transcriptions: {
        create: async () => {
          calls.n++;
          return { text: "from whisper api", duration: 5, words: [{ word: "from", start: 0.1, end: 0.4 }] };
        },
      },
    },
  } as unknown as OpenAI;
}

describe("resolveTranscriber", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    secrets.clear();
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    warn.mockRestore();
  });

  it("chưa cấu hình dịch vụ → undefined (nơi gọi dùng Whisper cũ nguyên vẹn)", async () => {
    expect(await resolveTranscriber(async () => fakeOpenai({ n: 0 }))).toBeUndefined();
  });

  it("có địa chỉ nhưng thiếu khoá API → undefined và cảnh báo (không gọi dịch vụ không khoá)", async () => {
    secrets.set("speech_analysis.base_url", "http://gpu/speech");
    expect(await resolveTranscriber(async () => fakeOpenai({ n: 0 }))).toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
  });

  it("cấu hình đủ: dùng dịch vụ, không đụng OpenAI (kể cả khi chưa cấu hình OpenAI)", async () => {
    secrets.set("speech_analysis.base_url", "http://gpu/speech");
    secrets.set("speech_analysis.api_key", "k-1");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(SERVICE_OK), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const t = (await resolveTranscriber(async () => {
      throw new Error("openai_not_configured");
    }))!;
    const r = await t(audio, { language: "en" });
    expect(r.text).toBe("from the service");
    expect(r.speechSegments).toEqual([{ start: 0.2, end: 4.5 }]);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe("http://gpu/speech/v1/analyze");
  });

  it.each([
    ["bận (503)", () => new Response('{"error":"busy"}', { status: 503 })],
    ["lỗi máy chủ (500)", () => new Response("x", { status: 500 })],
    ["phản hồi sai khuôn", () => new Response('{"hello":1}', { status: 200 })],
  ])("dịch vụ %s → rơi về Whisper qua OpenAI, chỉ ghi mã lý do", async (_name, respond) => {
    secrets.set("speech_analysis.base_url", "http://gpu/speech");
    secrets.set("speech_analysis.api_key", "SECRET-KEY");
    vi.stubGlobal("fetch", vi.fn(async () => respond()));
    const calls = { n: 0 };
    const t = (await resolveTranscriber(async () => fakeOpenai(calls)))!;
    const r = await t(audio, {});
    expect(r.text).toBe("from whisper api");
    expect(calls.n).toBe(1);
    const logged = warn.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logged).toMatch(/dùng Whisper qua OpenAI/);
    expect(logged).not.toContain("SECRET-KEY");
  });

  it("dịch vụ mạng lỗi và OpenAI cũng chưa cấu hình → ném lỗi thiếu cấu hình (không nuốt)", async () => {
    secrets.set("speech_analysis.base_url", "http://gpu/speech");
    secrets.set("speech_analysis.api_key", "k");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    const t = (await resolveTranscriber(async () => { throw new Error("openai_not_configured"); }))!;
    await expect(t(audio, {})).rejects.toThrow("openai_not_configured");
  });
});
