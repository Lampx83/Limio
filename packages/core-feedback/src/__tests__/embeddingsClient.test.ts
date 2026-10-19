import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EMBEDDING_DIM,
  EmbeddingNotConfiguredError,
  embedTexts,
  fitEmbedding,
  getEmbedCompute,
} from "../oralExam/embeddings";

const KEYS = ["EMBED_BASE_URL", "EMBED_MODEL", "EMBED_SECKEY"] as const;
const saved: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const k of KEYS) saved[k] = process.env[k];
  process.env.EMBED_BASE_URL = "http://emb.test:8037/ollama/";
  process.env.EMBED_SECKEY = "neu-emb-test";
  delete process.env.EMBED_MODEL;
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const vec = (n: number, v = 0.5) => new Array(n).fill(v);
function fakeServer(dim: number) {
  return vi.fn<typeof fetch>(async (_url, init) => {
    const body = JSON.parse(String((init as RequestInit).body));
    return Response.json({
      embeddings: (body.input as string[]).map(() => vec(dim)),
      prompt_eval_count: body.input.length * 3,
    });
  });
}

describe("embedTexts", () => {
  it("gọi /api/embed với model, seckey và xin đúng EMBEDDING_DIM chiều", async () => {
    const f = fakeServer(EMBEDDING_DIM);
    const r = await embedTexts(["a", "b"], f);
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe("http://emb.test:8037/ollama/api/embed");
    expect(new Headers((init as RequestInit).headers).get("x-ollama-seckey")).toBe("neu-emb-test");
    const sent = JSON.parse(String((init as RequestInit).body));
    expect(sent).toMatchObject({ model: "qwen3-embedding:8b-ctx16k", input: ["a", "b"], dimensions: EMBEDDING_DIM });
    expect(r.embeddings).toHaveLength(2);
    expect(r.embeddings[0]).toHaveLength(EMBEDDING_DIM);
    expect(r.tokensUsed).toBe(6);
  });

  it("chia lô khi nhiều đoạn, giữ đúng thứ tự và cộng token", async () => {
    const f = fakeServer(EMBEDDING_DIM);
    const texts = Array.from({ length: 40 }, (_, i) => `t${i}`);
    const r = await embedTexts(texts, f);
    expect(f).toHaveBeenCalledTimes(3); // 16 + 16 + 8
    expect(r.embeddings).toHaveLength(40);
    expect(r.tokensUsed).toBe(120);
  });

  it("server bỏ qua `dimensions` và trả 4096 chiều ⇒ cắt về 1536 và chuẩn hoá L2", async () => {
    const r = await embedTexts(["x"], fakeServer(4096));
    const v = r.embeddings[0]!;
    expect(v).toHaveLength(EMBEDDING_DIM);
    expect(Math.sqrt(v.reduce((s, x) => s + x * x, 0))).toBeCloseTo(1, 5);
  });

  it("server trả ít chiều hơn cột pgvector ⇒ lỗi, không đệm số 0", async () => {
    await expect(embedTexts(["x"], fakeServer(1024))).rejects.toThrow(/embedding_dim_too_small/);
  });

  it("HTTP lỗi ⇒ ném kèm status để tầng trên phân loại", async () => {
    const f = vi.fn<typeof fetch>(async () => new Response("nope", { status: 401 }));
    await expect(embedTexts(["x"], f)).rejects.toMatchObject({ status: 401 });
  });

  it("số vector trả về lệch số đoạn gửi ⇒ lỗi", async () => {
    const f = vi.fn<typeof fetch>(async () => Response.json({ embeddings: [vec(EMBEDDING_DIM)] }));
    await expect(embedTexts(["a", "b"], f)).rejects.toThrow("embedding_count_mismatch");
  });

  it("EMBED_MODEL ghi đè model mặc định", async () => {
    process.env.EMBED_MODEL = "other-embed";
    const f = fakeServer(EMBEDDING_DIM);
    await embedTexts(["a"], f);
    expect(JSON.parse(String((f.mock.calls[0]![1] as RequestInit).body)).model).toBe("other-embed");
  });

  it("chưa đặt EMBED_BASE_URL ⇒ EmbeddingNotConfiguredError, không gọi mạng", async () => {
    delete process.env.EMBED_BASE_URL;
    const f = fakeServer(EMBEDDING_DIM);
    await expect(embedTexts(["a"], f)).rejects.toBeInstanceOf(EmbeddingNotConfiguredError);
    expect(f).not.toHaveBeenCalled();
  });
});

describe("getEmbedCompute", () => {
  it("chưa cấu hình ⇒ null (caller lùi về tìm theo từ khoá)", () => {
    delete process.env.EMBED_BASE_URL;
    expect(getEmbedCompute()).toBeNull();
  });
  it("đã cấu hình ⇒ hàm compute dùng được", async () => {
    const compute = getEmbedCompute(fakeServer(EMBEDDING_DIM))!;
    expect((await compute(["a"])).embeddings).toHaveLength(1);
  });
});

describe("fitEmbedding", () => {
  it("đúng số chiều thì giữ nguyên (cùng tham chiếu)", () => {
    const v = vec(EMBEDDING_DIM);
    expect(fitEmbedding(v)).toBe(v);
  });
});
