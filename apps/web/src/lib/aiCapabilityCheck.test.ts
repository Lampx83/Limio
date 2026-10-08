import { describe, expect, it, vi } from "vitest";
import {
  runAiCapabilityChecks,
  silentWav,
  summarizeAiChecks,
  type AiCapabilityClient,
  type AiCheckResult,
} from "./aiCapabilityCheck";

function apiError(status: number, message: string, extra: Record<string, unknown> = {}) {
  return Object.assign(new Error(`${status} ${message}`), { status, ...extra });
}

/** Client giả: mỗi khả năng mặc định chạy được, test ghi đè từng cái. */
function fakeClient(over: {
  chat?: () => Promise<unknown>;
  embed?: () => Promise<unknown>;
  stt?: () => Promise<unknown>;
  tts?: () => Promise<unknown>;
} = {}) {
  type Fn = (...args: unknown[]) => Promise<unknown>;
  const calls = {
    chat: vi.fn<Fn>(over.chat ?? (async () => ({ model: "qwen3.5-35b-a3b-int4", choices: [{ message: { content: "OK" } }] }))),
    embed: vi.fn<Fn>(over.embed ?? (async () => ({ data: [{ embedding: new Array(1536).fill(0.1) }] }))),
    stt: vi.fn<Fn>(over.stt ?? (async () => ({ text: "" }))),
    tts: vi.fn<Fn>(over.tts ?? (async () => ({ arrayBuffer: async () => new ArrayBuffer(2048) }))),
  };
  const client = {
    chat: { completions: { create: calls.chat } },
    embeddings: { create: calls.embed },
    audio: { transcriptions: { create: calls.stt }, speech: { create: calls.tts } },
  } as unknown as AiCapabilityClient;
  return { client, calls };
}

const run = (o: Omit<Parameters<typeof runAiCapabilityChecks>[0], "embeddingModel">) =>
  runAiCapabilityChecks({ embeddingModel: "text-embedding-3-small", ...o });

const byId = (rs: AiCheckResult[], id: string) => rs.find((r) => r.id === id)!;

describe("runAiCapabilityChecks", () => {
  it("cả bốn chạy được ⇒ bốn kết quả ok theo thứ tự chat, embeddings, stt, tts", async () => {
    const { client } = fakeClient();
    const rs = await run({ chat: client, openai: client, chatBackend: "self-hosted" });
    expect(rs.map((r) => r.id)).toEqual(["chat", "embeddings", "stt", "tts"]);
    expect(rs.every((r) => r.ok && !r.skipped)).toBe(true);
    expect(typeof rs[0]!.ms).toBe("number");
    expect(byId(rs, "chat").detail).toContain("qwen3.5-35b-a3b-int4");
    expect(byId(rs, "chat").detail).toContain("tự host");
  });

  it("chat được thử bằng hội thoại CHỈ có system — đúng kiểu lượt mở màn vấn đáp mà Qwen từng trả 400", async () => {
    const { client, calls } = fakeClient();
    await run({ chat: client, openai: client, chatBackend: "openai" });
    const body = calls.chat.mock.calls[0]![0] as unknown as { messages: { role: string }[]; max_tokens: number };
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0]!.role).toBe("system");
    expect(body.max_tokens).toBeLessThanOrEqual(16);
  });

  it("một khả năng hỏng không làm hỏng các khả năng khác (Whisper 403, còn lại ok)", async () => {
    const { client } = fakeClient({
      stt: async () => {
        throw apiError(403, "You do not have access to this model.");
      },
    });
    const rs = await run({ chat: client, openai: client, chatBackend: "openai" });
    expect(byId(rs, "stt").ok).toBe(false);
    expect(byId(rs, "stt").hint).toMatch(/quyền/i);
    expect(byId(rs, "stt").hint).toMatch(/Whisper|transcri|speech-to-text/i);
    expect(byId(rs, "chat").ok && byId(rs, "embeddings").ok && byId(rs, "tts").ok).toBe(true);
  });

  it("embeddings sai số chiều ⇒ hỏng, vì cột pgvector cố định 1536", async () => {
    const { client } = fakeClient({ embed: async () => ({ data: [{ embedding: [0.1, 0.2] }] }) });
    const rs = await run({ chat: client, openai: client, chatBackend: "openai" });
    expect(byId(rs, "embeddings").ok).toBe(false);
    expect(byId(rs, "embeddings").error).toContain("1536");
  });

  it("TTS trả audio rỗng ⇒ hỏng", async () => {
    const { client } = fakeClient({ tts: async () => ({ arrayBuffer: async () => new ArrayBuffer(0) }) });
    const rs = await run({ chat: client, openai: client, chatBackend: "openai" });
    expect(byId(rs, "tts").ok).toBe(false);
  });

  it("chat trả nội dung rỗng ⇒ hỏng", async () => {
    const { client } = fakeClient({ chat: async () => ({ model: "m", choices: [{ message: { content: "  " } }] }) });
    const rs = await run({ chat: client, openai: client, chatBackend: "openai" });
    expect(byId(rs, "chat").ok).toBe(false);
  });

  it("treo quá hạn ⇒ báo timeout thay vì treo cả trang", async () => {
    const { client } = fakeClient({ tts: () => new Promise(() => undefined) });
    const rs = await run({ chat: client, openai: client, chatBackend: "openai", timeoutMs: 30 });
    expect(byId(rs, "tts").ok).toBe(false);
    expect(byId(rs, "tts").hint).toMatch(/quá|chậm|thời gian/i);
    expect(byId(rs, "chat").ok).toBe(true);
  });

  it("không có client OpenAI ⇒ embeddings/stt/tts được bỏ qua, chat vẫn chạy", async () => {
    const { client, calls } = fakeClient();
    const rs = await run({ chat: client, openai: null, chatBackend: "self-hosted" });
    expect(byId(rs, "chat").ok).toBe(true);
    for (const id of ["embeddings", "stt", "tts"]) {
      expect(byId(rs, id).skipped).toBe(true);
      expect(byId(rs, id).ok).toBe(false);
    }
    expect(calls.embed).not.toHaveBeenCalled();
    expect(calls.stt).not.toHaveBeenCalled();
    expect(calls.tts).not.toHaveBeenCalled();
  });

  it("không có client chat ⇒ chat được bỏ qua", async () => {
    const { client } = fakeClient();
    const rs = await run({ chat: null, openai: client, chatBackend: "openai" });
    expect(byId(rs, "chat").skipped).toBe(true);
  });

  it("lỗi chứa chuỗi giống API key thì bị che — không đưa key ra trình duyệt", async () => {
    const { client } = fakeClient({
      embed: async () => {
        throw apiError(401, "Incorrect API key provided: sk-proj-abcdefghijklmnopqrstuv.");
      },
    });
    const rs = await run({ chat: client, openai: client, chatBackend: "openai" });
    expect(byId(rs, "embeddings").error).not.toContain("abcdefghijklmnop");
    expect(byId(rs, "embeddings").hint).toMatch(/key/i);
  });

  it.each([
    [404, "The model `tts-1` does not exist", undefined, /model|project/i],
    [429, "You exceeded your current quota", "insufficient_quota", /quota|tiền|billing|thanh toán/i],
    [429, "Rate limit reached", "rate_limit_exceeded", /giới hạn|thử lại/i],
    [500, "The server had an error", undefined, /OpenAI|máy chủ|thử lại/i],
  ])("lỗi %i ⇒ có gợi ý cách xử lý", async (status, message, code, hintRe) => {
    const { client } = fakeClient({
      tts: async () => {
        throw apiError(status as number, message as string, code ? { code } : {});
      },
    });
    const rs = await run({ chat: client, openai: client, chatBackend: "openai" });
    expect(byId(rs, "tts").hint).toMatch(hintRe as RegExp);
  });

  it("chat tự host trả 400 'No user query' ⇒ gợi ý đúng nguyên nhân", async () => {
    const { client } = fakeClient({
      chat: async () => {
        throw apiError(400, "No user query found in messages.");
      },
    });
    const rs = await run({ chat: client, openai: client, chatBackend: "self-hosted" });
    expect(byId(rs, "chat").ok).toBe(false);
    expect(byId(rs, "chat").hint).toMatch(/user/i);
  });
});

describe("summarizeAiChecks", () => {
  const ok = (id: AiCheckResult["id"]): AiCheckResult => ({ id, label: id, usedFor: "", ok: true, ms: 1 });
  const bad = (id: AiCheckResult["id"]): AiCheckResult => ({ id, label: id, usedFor: "", ok: false, ms: 1, error: "x" });

  it("tất cả ok ⇒ vấn đáp chữ và giọng nói đều dùng được", () => {
    const s = summarizeAiChecks([ok("chat"), ok("embeddings"), ok("stt"), ok("tts")]);
    expect(s.map((x) => x.status)).toEqual(["ok", "ok"]);
  });

  it("thiếu embeddings ⇒ vấn đáp chữ vẫn dùng được (cảnh báo: chọn đoạn theo từ khoá)", () => {
    const s = summarizeAiChecks([ok("chat"), bad("embeddings"), ok("stt"), ok("tts")]);
    expect(s[0]!.status).toBe("warn");
    expect(s[0]!.text).toMatch(/từ khoá/);
  });

  it("thiếu Whisper ⇒ vấn đáp giọng nói KHÔNG dùng được, chữ vẫn ok", () => {
    const s = summarizeAiChecks([ok("chat"), ok("embeddings"), bad("stt"), ok("tts")]);
    expect(s[0]!.status).toBe("ok");
    expect(s[1]!.status).toBe("fail");
  });

  it("thiếu TTS ⇒ giọng nói vẫn chạy nhưng cảnh báo không có tiếng", () => {
    const s = summarizeAiChecks([ok("chat"), ok("embeddings"), ok("stt"), bad("tts")]);
    expect(s[1]!.status).toBe("warn");
  });

  it("chat hỏng ⇒ cả hai đều không dùng được", () => {
    const s = summarizeAiChecks([bad("chat"), ok("embeddings"), ok("stt"), ok("tts")]);
    expect(s.map((x) => x.status)).toEqual(["fail", "fail"]);
  });
});

describe("silentWav", () => {
  it("sinh WAV PCM 16-bit mono hợp lệ, độ dài đúng", () => {
    const wav = silentWav(0.5, 16000);
    expect(wav.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(wav.subarray(8, 12).toString("ascii")).toBe("WAVE");
    const dataBytes = 0.5 * 16000 * 2;
    expect(wav.readUInt32LE(40)).toBe(dataBytes);
    expect(wav.length).toBe(44 + dataBytes);
    expect(wav.readUInt32LE(4)).toBe(wav.length - 8);
  });
});
