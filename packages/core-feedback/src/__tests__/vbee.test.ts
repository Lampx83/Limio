import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  splitForTts,
  vbeeSpeechToText,
  vbeeTextToSpeech,
  VbeeError,
} from "../oralExam/vbee";

describe("splitForTts (A6.6)", () => {
  it("returns empty array for empty text", () => {
    expect(splitForTts("")).toEqual([]);
    expect(splitForTts("   ")).toEqual([]);
  });

  it("returns a single chunk when under the limit", () => {
    expect(splitForTts("Xin chào.", 300)).toEqual(["Xin chào."]);
  });

  it("splits on sentence boundaries without exceeding maxChars", () => {
    const a = "A".repeat(40) + ".";
    const b = "B".repeat(40) + ".";
    const c = "C".repeat(40) + ".";
    const text = `${a} ${b} ${c}`;
    const chunks = splitForTts(text, 90);
    for (const c2 of chunks) expect(c2.length).toBeLessThanOrEqual(90);
    expect(chunks.join(" ")).toContain(a);
    expect(chunks.join(" ")).toContain(c);
  });

  it("hard-splits a single sentence longer than maxChars on whitespace", () => {
    const words = Array.from({ length: 20 }, (_, i) => `word${i}`);
    const sentence = words.join(" ") + ".";
    const chunks = splitForTts(sentence, 50);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(50);
    expect(chunks.join(" ").replace(/\.$/, "").split(/\s+/).filter(Boolean)).toEqual(words);
  });
});

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
    arrayBuffer: async () => new TextEncoder().encode(JSON.stringify(body)).buffer,
  };
}

describe("vbeeTextToSpeech (A6.6)", () => {
  const creds = { appId: "app-1", token: "tok-1" };

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls the TTS endpoint once per chunk with the right headers/body", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      json: async () => ({}),
    });

    const result = await vbeeTextToSpeech(creds, "voice-x")("Xin chào bạn.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.vbee.vn/v1/tts");
    expect(init.headers["Authorization"]).toBe("Bearer tok-1");
    expect(init.headers["App-Id"]).toBe("app-1");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ text: "Xin chào bạn.", mode: "sync", voiceCode: "voice-x" });
    expect(result.audioChunks).toHaveLength(1);
    expect(result.contentType).toBe("audio/mpeg");
  });

  it("calls the endpoint once per split chunk for long text", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => new Uint8Array([9]).buffer,
      json: async () => ({}),
    });
    const longText = Array.from(
      { length: 10 },
      (_, i) => `Đây là câu số ${i} được viết khá dài để chắc chắn vượt quá giới hạn ba trăm ký tự cho phép.`,
    ).join(" ");
    const result = await vbeeTextToSpeech(creds)(longText);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
    expect(result.audioChunks.length).toBe(fetchMock.mock.calls.length);
  });

  it("throws VbeeError on a non-ok response", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: "BAD_REQUEST", message: "bad" } }, false, 400),
    );
    await expect(vbeeTextToSpeech(creds)("Xin chào")).rejects.toBeInstanceOf(VbeeError);
  });
});

describe("vbeeSpeechToText (A6.6)", () => {
  const creds = { appId: "app-1", token: "tok-1" };

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns immediately when the submit response is already COMPLETED", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ transcriptId: "t1", status: "COMPLETED", transcript: "xin chào" }),
    );
    const r = await vbeeSpeechToText(creds, { pollIntervalMs: 1 })(Buffer.from("audio"), "audio/wav");
    expect(r.transcript).toBe("xin chào");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("polls until COMPLETED", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ transcriptId: "t2", status: "PENDING" }))
      .mockResolvedValueOnce(jsonResponse({ transcriptId: "t2", status: "PROCESSING" }))
      .mockResolvedValueOnce(
        jsonResponse({ transcriptId: "t2", status: "COMPLETED", transcript: "đã xong" }),
      );
    const r = await vbeeSpeechToText(creds, { pollIntervalMs: 1, maxPolls: 5 })(
      Buffer.from("audio"),
      "audio/wav",
    );
    expect(r.transcript).toBe("đã xong");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("throws stt_failed when Vbee reports FAILED", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ transcriptId: "t3", status: "PENDING" }))
      .mockResolvedValueOnce(jsonResponse({ transcriptId: "t3", status: "FAILED" }));
    await expect(
      vbeeSpeechToText(creds, { pollIntervalMs: 1, maxPolls: 5 })(Buffer.from("x"), "audio/wav"),
    ).rejects.toMatchObject({ code: "stt_failed" });
  });

  it("throws stt_timeout after maxPolls without completion", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(jsonResponse({ transcriptId: "t4", status: "PENDING" }));
    fetchMock.mockResolvedValue(jsonResponse({ transcriptId: "t4", status: "PROCESSING" }));
    await expect(
      vbeeSpeechToText(creds, { pollIntervalMs: 1, maxPolls: 3 })(Buffer.from("x"), "audio/wav"),
    ).rejects.toMatchObject({ code: "stt_timeout" });
  });

  it("throws stt_submit_failed on a non-ok submit response", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "bad" }, false, 400));
    await expect(
      vbeeSpeechToText(creds)(Buffer.from("x"), "audio/wav"),
    ).rejects.toMatchObject({ code: "stt_submit_failed" });
  });
});
