import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class IntegrationError extends Error {
    constructor(public readonly code: string) {
      super(code);
    }
  }
  return {
    IntegrationError,
    getIntegrationSecret: vi.fn(),
    isSelfHostedChat: vi.fn(),
    embedMaterial: vi.fn(),
    openAiEmbedCompute: vi.fn(),
    createOpenaiClient: vi.fn(),
    getChatOnlyApiKey: vi.fn(),
  };
});

vi.mock("@feedbackme/core-lms", () => ({
  IntegrationError: mocks.IntegrationError,
  getIntegrationSecret: mocks.getIntegrationSecret,
}));
vi.mock("@feedbackme/core-feedback", () => ({
  isSelfHostedChat: mocks.isSelfHostedChat,
  embedMaterial: mocks.embedMaterial,
  openAiEmbedCompute: mocks.openAiEmbedCompute,
}));
vi.mock("@/lib/openaiClient", () => ({
  createOpenaiClient: mocks.createOpenaiClient,
  getChatOnlyApiKey: mocks.getChatOnlyApiKey,
}));

import { getOralExamTextAi, tryEmbedMaterial } from "./oralExamEmbed";

const noKey = () => new mocks.IntegrationError("key_not_found");

beforeEach(() => {
  vi.resetAllMocks();
  mocks.createOpenaiClient.mockImplementation((k: string) => ({ apiKey: k }));
  mocks.openAiEmbedCompute.mockReturnValue("EMBED_FN");
  mocks.getChatOnlyApiKey.mockResolvedValue("self-hosted-llm");
});

describe("getOralExamTextAi", () => {
  it("có OpenAI key: dùng key thật và có hàm embeddings (đường vector như cũ)", async () => {
    mocks.getIntegrationSecret.mockResolvedValue("sk-real");
    const r = await getOralExamTextAi();
    expect(mocks.createOpenaiClient).toHaveBeenCalledWith("sk-real");
    expect(r.computeEmbed).toBe("EMBED_FN");
  });

  it("không key nhưng chat tự host: vẫn chạy, computeEmbed = null và dùng key giả cho chat", async () => {
    mocks.getIntegrationSecret.mockRejectedValue(noKey());
    mocks.isSelfHostedChat.mockReturnValue(true);
    const r = await getOralExamTextAi();
    expect(r.computeEmbed).toBeNull();
    expect(mocks.createOpenaiClient).toHaveBeenCalledWith("self-hosted-llm");
  });

  it("không key và chat vẫn đi OpenAI: ném openai_not_configured (không có gì để hỏi)", async () => {
    mocks.getIntegrationSecret.mockRejectedValue(noKey());
    mocks.isSelfHostedChat.mockReturnValue(false);
    await expect(getOralExamTextAi()).rejects.toThrow("openai_not_configured");
  });

  it("lỗi khác key_not_found (vd giải mã hỏng) không bị nuốt thành 'tự host'", async () => {
    mocks.getIntegrationSecret.mockRejectedValue(new mocks.IntegrationError("decrypt_failed"));
    mocks.isSelfHostedChat.mockReturnValue(true);
    await expect(getOralExamTextAi()).rejects.toThrow("decrypt_failed");
  });
});

describe("tryEmbedMaterial", () => {
  it("không key + tự host: lưu chunk không vector và báo tài liệu dùng được (true)", async () => {
    mocks.getIntegrationSecret.mockRejectedValue(noKey());
    mocks.isSelfHostedChat.mockReturnValue(true);
    mocks.embedMaterial.mockResolvedValue({ chunkCount: 3, skipped: false, embedded: false });
    expect(await tryEmbedMaterial("u1", "m1")).toBe(true);
    expect(mocks.embedMaterial).toHaveBeenCalledWith("u1", "m1", null);
  });

  it("tài liệu không có chữ (skipped): false để GV biết", async () => {
    mocks.getIntegrationSecret.mockResolvedValue("sk-real");
    mocks.embedMaterial.mockResolvedValue({ chunkCount: 0, skipped: true, embedded: false });
    expect(await tryEmbedMaterial("u1", "m1")).toBe(false);
  });

  it("không bao giờ ném: không key và không tự host ⇒ false", async () => {
    mocks.getIntegrationSecret.mockRejectedValue(noKey());
    mocks.isSelfHostedChat.mockReturnValue(false);
    expect(await tryEmbedMaterial("u1", "m1")).toBe(false);
    expect(mocks.embedMaterial).not.toHaveBeenCalled();
  });
});
