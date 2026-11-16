import { describe, expect, it } from "vitest";
import { SpeechServiceError, speechServiceTranscriber, withSpeechFallback } from "../speaking/speechService";
import type { Transcriber } from "../speaking/feedback";

// docs/tieu-chi/limio-language-cham-noi-bang-mic.md AC1 — dịch vụ phân tích tiếng nói nội bộ

const OK_BODY = {
  version: "1",
  engine: { name: "faster-whisper", model: "tiny", version: "1.2.0" },
  language: "en",
  durationSec: 6.5,
  text: "I like to read books.",
  words: [
    { word: "I", start: 0.5, end: 0.7, probability: 0.9 },
    { word: "like", start: 0.8, end: 1.1, probability: 0.9 },
  ],
  speechSegments: [{ start: 0.5, end: 5.9 }],
};
const audio = { buffer: Buffer.from([1, 2, 3, 4]), mimeType: "audio/webm" };

interface Seen {
  url: string;
  auth: string | null;
  apiKeyHeader: string | null;
  language: FormDataEntryValue | null;
  fileSize: number | null;
  fileName: string | null;
  hasSignal: boolean;
}
function fakeFetch(respond: (seen: Seen) => Response | Promise<Response>) {
  const seen: Seen[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    const form = init.body as FormData;
    const file = form.get("audio") as File | null;
    const s: Seen = {
      url,
      auth: new Headers(init.headers).get("authorization"),
      apiKeyHeader: new Headers(init.headers).get("x-api-key"),
      language: form.get("language"),
      fileSize: file ? file.size : null,
      fileName: file ? file.name : null,
      hasSignal: !!init.signal,
    };
    seen.push(s);
    return respond(s);
  }) as unknown as typeof fetch;
  return { fetchImpl, seen };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("speechServiceTranscriber", () => {
  it("gửi âm thanh + ngôn ngữ kèm khoá, đọc lại chữ, mốc từng từ, đoạn nói và thông tin bộ máy", async () => {
    const { fetchImpl, seen } = fakeFetch(() => json(OK_BODY));
    const t = speechServiceTranscriber({ baseUrl: "http://gpu:8080/speech/", apiKey: "k-123", fetchImpl });
    const r = await t(audio, { language: "en" });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ url: "http://gpu:8080/speech/v1/analyze", auth: "Bearer k-123", apiKeyHeader: "k-123", language: "en", fileSize: 4, hasSignal: true });
    expect(seen[0]!.fileName).toMatch(/\.webm$/);
    expect(r.text).toBe("I like to read books.");
    expect(r.durationSec).toBe(6.5);
    expect(r.words).toEqual([
      { start: 0.5, end: 0.7 },
      { start: 0.8, end: 1.1 },
    ]);
    expect(r.speechSegments).toEqual([{ start: 0.5, end: 5.9 }]);
    expect(r.engine).toEqual({ name: "faster-whisper", model: "tiny", version: "1.2.0" });
  });

  it("không gửi language khi khoá không rõ ngôn ngữ (để dịch vụ tự nhận)", async () => {
    const { fetchImpl, seen } = fakeFetch(() => json(OK_BODY));
    await speechServiceTranscriber({ baseUrl: "http://gpu", apiKey: "k", fetchImpl })(audio, {});
    expect(seen[0]!.language).toBeNull();
  });

  it.each([
    [503, { error: "busy" }, "busy"],
    [401, { error: "unauthorized" }, "http_401"],
    [500, { error: "boom" }, "http_500"],
  ])("HTTP %s → SpeechServiceError", async (status, body, code) => {
    const { fetchImpl } = fakeFetch(() => json(body, status));
    await expect(speechServiceTranscriber({ baseUrl: "http://gpu", apiKey: "k", fetchImpl })(audio, {})).rejects.toMatchObject({ code });
  });

  it("phản hồi sai khuôn (thiếu chữ, mốc không phải số) → bad_response, không đoán", async () => {
    for (const bad of [{ ...OK_BODY, text: undefined }, { ...OK_BODY, durationSec: "x" }, { ...OK_BODY, words: [{ start: "a", end: 1 }] }, "không phải json"]) {
      const { fetchImpl } = fakeFetch(() => (typeof bad === "string" ? new Response(bad, { status: 200 }) : json(bad)));
      await expect(speechServiceTranscriber({ baseUrl: "http://gpu", apiKey: "k", fetchImpl })(audio, {})).rejects.toMatchObject({ code: "bad_response" });
    }
  });

  it("đoạn nói hỏng thì bỏ riêng đoạn nói (vẫn dùng được mốc từ), không làm hỏng cả kết quả", async () => {
    const { fetchImpl } = fakeFetch(() => json({ ...OK_BODY, speechSegments: [{ start: "x", end: 2 }] }));
    const r = await speechServiceTranscriber({ baseUrl: "http://gpu", apiKey: "k", fetchImpl })(audio, {});
    expect(r.speechSegments).toBeUndefined();
    expect(r.words).toHaveLength(2);
  });

  it("lỗi mạng và quá giờ → network / timeout", async () => {
    const net = speechServiceTranscriber({ baseUrl: "http://gpu", apiKey: "k", fetchImpl: (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch });
    await expect(net(audio, {})).rejects.toMatchObject({ code: "network" });
    const slow = speechServiceTranscriber({
      baseUrl: "http://gpu",
      apiKey: "k",
      timeoutMs: 20,
      fetchImpl: ((_u: string, init: RequestInit) => new Promise((_r, rej) => init.signal!.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "TimeoutError" }))))) as unknown as typeof fetch,
    });
    await expect(slow(audio, {})).rejects.toMatchObject({ code: "timeout" });
  });

  it("lỗi không lộ khoá API", async () => {
    const { fetchImpl } = fakeFetch(() => json({ error: "boom" }, 500));
    const err = await speechServiceTranscriber({ baseUrl: "http://gpu", apiKey: "SECRET-KEY-VALUE", fetchImpl })(audio, {}).then(
      () => new Error("không lỗi"),
      (e: Error) => e,
    );
    expect(err).toBeInstanceOf(SpeechServiceError);
    expect(String(err.message)).not.toContain("SECRET-KEY-VALUE");
  });
});

describe("withSpeechFallback — dịch vụ lỗi thì rơi về cách cũ", () => {
  const good: Transcriber = async () => ({ text: "from whisper api", durationSec: 5, words: [] });
  const bad = (code: ConstructorParameters<typeof SpeechServiceError>[0]): Transcriber => async () => {
    throw new SpeechServiceError(code);
  };

  it("dịch vụ chạy được thì dùng kết quả của dịch vụ, không gọi cách cũ", async () => {
    let fallbackCalls = 0;
    const t = withSpeechFallback(
      async () => ({ text: "from service", durationSec: 5, words: [] }),
      async () => (fallbackCalls++, good(audio, {})),
    );
    expect((await t(audio, {})).text).toBe("from service");
    expect(fallbackCalls).toBe(0);
  });

  it.each(["busy", "timeout", "network", "http_500", "bad_response"] as const)("dịch vụ lỗi %s → dùng cách cũ và báo lý do (chỉ mã, không chữ)", async (code) => {
    const reasons: string[] = [];
    const t = withSpeechFallback(bad(code), good, (r) => reasons.push(r));
    expect((await t(audio, {})).text).toBe("from whisper api");
    expect(reasons).toEqual([code]);
  });

  it("cách cũ cũng lỗi thì ném lỗi của cách cũ (không nuốt)", async () => {
    const t = withSpeechFallback(bad("network"), async () => {
      throw new Error("openai_not_configured");
    });
    await expect(t(audio, {})).rejects.toThrow("openai_not_configured");
  });

  it("cách cũ chỉ được tạo khi cần (thiếu cấu hình AI không lộ khi dịch vụ chạy được)", async () => {
    let created = 0;
    const t = withSpeechFallback(async () => ({ text: "ok", durationSec: 1, words: [] }), async (...a) => (created++, good(...a)));
    await t(audio, {});
    expect(created).toBe(0);
  });
});
