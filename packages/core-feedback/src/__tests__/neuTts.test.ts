import { afterEach, describe, expect, it, vi } from "vitest";
import { isTtsProviderError, NEU_TTS_MAX_CHARS, neuTextToSpeech, NeuTtsError } from "../oralExam/neuTts";

// A6.6 — chỉ test phần thuần của adapter (URL, header, chunking, mapping lỗi)
// bằng fetch giả — không gọi dịch vụ TTS thật.

const config = { baseUrl: "http://gw.example:8037/tts/", apiKey: "k-test" };

function okWav(): Response {
  return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("neuTextToSpeech", () => {
  it("POSTs to <base>/v1/speech with the Kong x-api-key header and default voice", async () => {
    const fetchMock = vi.fn(async () => okWav());
    vi.stubGlobal("fetch", fetchMock);

    const result = await neuTextToSpeech(config)("Xin chào bạn.");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://gw.example:8037/tts/v1/speech");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("k-test");
    expect(JSON.parse(init.body as string)).toEqual({
      text: "Xin chào bạn.",
      voice: "baotrang",
      normalize: true,
    });
    expect(result.contentType).toBe("audio/wav");
    expect(result.audioChunks).toHaveLength(1);
    expect(Array.from(result.audioChunks[0] ?? [])).toEqual([1, 2, 3]);
  });

  it("uses the configured voice", async () => {
    const fetchMock = vi.fn(async () => okWav());
    vi.stubGlobal("fetch", fetchMock);

    await neuTextToSpeech({ ...config, voice: "hamy" })("Chào.");

    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(JSON.parse(init.body as string).voice).toBe("hamy");
  });

  it("splits long answers into segments under NEU_TTS_MAX_CHARS, one request each", async () => {
    const fetchMock = vi.fn(async () => okWav());
    vi.stubGlobal("fetch", fetchMock);
    const sentence = "Đây là một câu thử nghiệm dài. ";
    const longText = sentence.repeat(Math.ceil((NEU_TTS_MAX_CHARS * 2.5) / sentence.length));

    const result = await neuTextToSpeech(config)(longText);

    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(result.audioChunks).toHaveLength(fetchMock.mock.calls.length);
    for (const call of fetchMock.mock.calls) {
      const body = JSON.parse((call as unknown as [string, RequestInit])[1].body as string);
      expect(body.text.length).toBeLessThanOrEqual(NEU_TTS_MAX_CHARS);
    }
  });

  it("maps a non-2xx response to NeuTtsError tts_failed with the status", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 401 })));

    const err = await neuTextToSpeech(config)("Xin chào").catch((e) => e);

    expect(err).toBeInstanceOf(NeuTtsError);
    expect(err.code).toBe("tts_failed");
    expect(err.details).toEqual({ status: 401 });
    expect(isTtsProviderError(err)).toBe(true);
  });

  it("maps a network failure to NeuTtsError tts_failed", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));

    await expect(neuTextToSpeech(config)("Xin chào")).rejects.toBeInstanceOf(NeuTtsError);
  });
});
