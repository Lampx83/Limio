import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class IntegrationError extends Error {
    constructor(public readonly code: string) {
      super(code);
    }
  }
  return {
    IntegrationError,
    embedMaterial: vi.fn(),
    getEmbedCompute: vi.fn(),
    createOpenaiClient: vi.fn(),
    getChatOnlyApiKey: vi.fn(),
  };
});

vi.mock("@feedbackme/core-lms", () => ({ IntegrationError: mocks.IntegrationError }));
vi.mock("@feedbackme/core-feedback", () => ({
  embedMaterial: mocks.embedMaterial,
  getEmbedCompute: mocks.getEmbedCompute,
}));
vi.mock("@/lib/openaiClient", () => ({
  createOpenaiClient: mocks.createOpenaiClient,
  getChatOnlyApiKey: mocks.getChatOnlyApiKey,
}));

import { getOralExamTextAi, tryEmbedMaterial } from "./oralExamEmbed";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.createOpenaiClient.mockImplementation((k: string) => ({ apiKey: k }));
  mocks.getChatOnlyApiKey.mockResolvedValue("self-hosted-llm");
  mocks.getEmbedCompute.mockReturnValue("EMBED_FN");
});

describe("getOralExamTextAi", () => {
  it("đã cấu hình embeddings: có hàm embeddings (đường vector), chat không cần OpenAI key", async () => {
    const r = await getOralExamTextAi();
    expect(mocks.createOpenaiClient).toHaveBeenCalledWith("self-hosted-llm");
    expect(r.computeEmbed).toBe("EMBED_FN");
  });

  it("chưa đặt EMBED_BASE_URL: computeEmbed = null ⇒ lõi vấn đáp tìm theo từ khoá", async () => {
    mocks.getEmbedCompute.mockReturnValue(null);
    const r = await getOralExamTextAi();
    expect(r.computeEmbed).toBeNull();
  });

  it("chưa đặt LLM_BASE_URL (chat): ném openai_not_configured", async () => {
    mocks.getChatOnlyApiKey.mockRejectedValue(new mocks.IntegrationError("key_not_found"));
    await expect(getOralExamTextAi()).rejects.toThrow("openai_not_configured");
  });

  it("lỗi khác (vd thiếu master key) không bị nuốt thành openai_not_configured", async () => {
    mocks.getChatOnlyApiKey.mockRejectedValue(new mocks.IntegrationError("master_key_missing"));
    await expect(getOralExamTextAi()).rejects.toMatchObject({ code: "master_key_missing" });
  });
});

describe("tryEmbedMaterial", () => {
  it("có hàm embeddings: embed bằng nó và báo true", async () => {
    mocks.embedMaterial.mockResolvedValue({ chunkCount: 3, skipped: false, embedded: true });
    expect(await tryEmbedMaterial("u1", "m1")).toBe(true);
    expect(mocks.embedMaterial).toHaveBeenCalledWith("u1", "m1", "EMBED_FN");
  });

  it("chưa cấu hình embeddings: vẫn lưu đoạn (compute=null) và báo true — AI tìm theo từ khoá", async () => {
    mocks.getEmbedCompute.mockReturnValue(null);
    mocks.embedMaterial.mockResolvedValue({ chunkCount: 3, skipped: false, embedded: false });
    expect(await tryEmbedMaterial("u1", "m1")).toBe(true);
    expect(mocks.embedMaterial).toHaveBeenCalledWith("u1", "m1", null);
  });

  it("tài liệu chưa trích được chữ (skipped) ⇒ false", async () => {
    mocks.embedMaterial.mockResolvedValue({ chunkCount: 0, skipped: true, embedded: false });
    expect(await tryEmbedMaterial("u1", "m1")).toBe(false);
  });

  it("không bao giờ ném: chat chưa cấu hình ⇒ false, không gọi embedMaterial", async () => {
    mocks.getChatOnlyApiKey.mockRejectedValue(new mocks.IntegrationError("key_not_found"));
    expect(await tryEmbedMaterial("u1", "m1")).toBe(false);
    expect(mocks.embedMaterial).not.toHaveBeenCalled();
  });
});
