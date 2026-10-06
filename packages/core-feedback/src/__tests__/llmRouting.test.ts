import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createChatRoutingFetch,
  getChatModel,
  DEFAULT_CHAT_MODEL,
  OPENAI_FALLBACK_CHAT_MODEL,
} from "../aiTutor/llm";

const ENV_KEYS = ["LLM_BASE_URL", "LLM_CHAT_MODEL", "LLM_SECKEY"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

function fakeFetch() {
  return vi.fn<typeof fetch>(async () => new Response("{}"));
}

describe("createChatRoutingFetch", () => {
  it("chuyển /chat/completions sang vLLM, thay Authorization bằng seckey, tắt thinking", async () => {
    process.env.LLM_BASE_URL = "http://llm.test:8037/vllm/v1/";
    process.env.LLM_SECKEY = "s3cret";
    const base = fakeFetch();
    const f = createChatRoutingFetch(base);

    await f("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { authorization: "Bearer sk-openai", "content-type": "application/json" },
      body: JSON.stringify({ model: "m", messages: [], stream: true }),
    });

    const [url, init] = base.mock.calls[0]!;
    expect(url).toBe("http://llm.test:8037/vllm/v1/chat/completions");
    const headers = new Headers(init!.headers);
    expect(headers.get("authorization")).toBeNull();
    expect(headers.get("x-ollama-seckey")).toBe("s3cret");
    const sent = JSON.parse(init!.body as string);
    expect(sent.chat_template_kwargs).toEqual({ enable_thinking: false });
    expect(sent.stream).toBe(true);
  });

  it("giữ nguyên chat_template_kwargs mà caller đã đặt", async () => {
    process.env.LLM_BASE_URL = "http://llm.test/v1";
    const base = fakeFetch();
    await createChatRoutingFetch(base)("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify({ chat_template_kwargs: { enable_thinking: true } }),
    });
    const sent = JSON.parse(base.mock.calls[0]![1]!.body as string);
    expect(sent.chat_template_kwargs.enable_thinking).toBe(true);
  });

  it("không đụng tới embeddings / audio — vẫn đi OpenAI với key gốc", async () => {
    process.env.LLM_BASE_URL = "http://llm.test/v1";
    const base = fakeFetch();
    const f = createChatRoutingFetch(base);
    await f("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { authorization: "Bearer sk-openai" },
      body: "{}",
    });
    const req = base.mock.calls[0]![0] as Request;
    expect(req.url).toBe("https://api.openai.com/v1/embeddings");
    expect(req.headers.get("authorization")).toBe("Bearer sk-openai");
  });

  it("không đặt LLM_BASE_URL ⇒ chat vẫn đi OpenAI", async () => {
    delete process.env.LLM_BASE_URL;
    const base = fakeFetch();
    await createChatRoutingFetch(base)("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { authorization: "Bearer sk-openai" },
      body: "{}",
    });
    const req = base.mock.calls[0]![0] as Request;
    expect(req.url).toBe("https://api.openai.com/v1/chat/completions");
  });
});

describe("getChatModel", () => {
  it("có LLM_BASE_URL ⇒ mặc định Qwen; chưa có ⇒ model OpenAI hợp lệ; LLM_CHAT_MODEL ghi đè được", () => {
    delete process.env.LLM_CHAT_MODEL;
    process.env.LLM_BASE_URL = "http://llm.test/v1";
    expect(getChatModel()).toBe(DEFAULT_CHAT_MODEL);
    delete process.env.LLM_BASE_URL;
    expect(getChatModel()).toBe(OPENAI_FALLBACK_CHAT_MODEL);
    process.env.LLM_CHAT_MODEL = "other-model";
    expect(getChatModel()).toBe("other-model");
  });
});
