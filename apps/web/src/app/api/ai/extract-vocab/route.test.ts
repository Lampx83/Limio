import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * LANG G2.5 / G2.5.3 — POST /api/ai/extract-vocab. Cùng quyền và cùng cách xử lý
 * lỗi với /api/ai/extract-questions; khác ở chỗ trả danh sách từ vựng.
 */

const requireUserId = vi.fn();
const isAdmin = vi.fn();
const findFirstInstructor = vi.fn();
const extractVocabFromText = vi.fn();
const getOpenaiClient = vi.fn();

vi.mock("@/lib/session", () => ({ requireUserId }));
vi.mock("@/lib/openaiClient", () => ({ getOpenaiClient }));
vi.mock("@feedbackme/core-lms", () => ({ isAdmin }));
// Chỉ lộ đúng một lời gọi đọc: nếu route lỡ ghi DB thì test này đỏ ngay (G2.5.3.3).
vi.mock("@feedbackme/db", () => ({ prisma: { courseInstructor: { findFirst: findFirstInstructor } } }));
vi.mock("@feedbackme/core-feedback", () => {
  class AiTutorError extends Error {
    constructor(public code: string, public details?: unknown) {
      super(code);
    }
  }
  class AiGenerationError extends Error {
    constructor(public code: string, public details?: unknown) {
      super(code);
    }
  }
  return { extractVocabFromText, AiTutorError, AiGenerationError };
});

const ME = "11111111-2222-4333-8444-555555555555";
const RAW = "你好 nǐ hǎo xin chào\n谢谢 xièxie cảm ơn";
const post = async (body: unknown, raw?: string) => {
  const { POST } = await import("./route");
  return POST(
    new Request("http://x/api/ai/extract-vocab", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: raw ?? JSON.stringify(body),
    }),
  );
};
const result = { items: [{ term: "你好", meaning: "xin chào", filled: [] }], skipped: [{ reason: "Thiếu nghĩa" }] };

describe("POST /api/ai/extract-vocab", () => {
  beforeEach(() => {
    requireUserId.mockReset().mockResolvedValue(ME);
    isAdmin.mockReset().mockResolvedValue(false);
    findFirstInstructor.mockReset().mockResolvedValue({ id: "ci" });
    getOpenaiClient.mockReset().mockResolvedValue({ fake: "openai" });
    extractVocabFromText.mockReset().mockResolvedValue(result);
  });

  it("G2.5.3.1: chưa đăng nhập → 401, không gọi AI", async () => {
    requireUserId.mockResolvedValue(null);
    expect((await post({ rawText: RAW })).status).toBe(401);
    expect(extractVocabFromText).not.toHaveBeenCalled();
    expect(getOpenaiClient).not.toHaveBeenCalled();
  });

  it("G2.5.3.1: không phải giảng viên của khoá nào và không phải admin → 403, không gọi AI", async () => {
    findFirstInstructor.mockResolvedValue(null);
    expect((await post({ rawText: RAW })).status).toBe(403);
    expect(extractVocabFromText).not.toHaveBeenCalled();
  });

  it("admin không cần là giảng viên của khoá nào; giảng viên của ít nhất một khoá thì được", async () => {
    findFirstInstructor.mockResolvedValue(null);
    isAdmin.mockResolvedValue(true);
    expect((await post({ rawText: RAW })).status).toBe(200);
    isAdmin.mockResolvedValue(false);
    findFirstInstructor.mockResolvedValue({ id: "ci" });
    expect((await post({ rawText: RAW })).status).toBe(200);
  });

  it("G2.5.3.1: thân yêu cầu sai kiểu → 400, không gọi AI", async () => {
    for (const bad of [{}, { rawText: 5 }, { rawText: RAW, fillMissing: "có" }, null]) {
      expect((await post(bad)).status, JSON.stringify(bad)).toBe(400);
    }
    expect((await post(null, "{không phải json")).status).toBe(400);
    expect(extractVocabFromText).not.toHaveBeenCalled();
  });

  it("thành công: gọi hàm sinh với người dùng hiện tại, mặc định chế độ chỉ trích xuất, trả { items, skipped }", async () => {
    const res = await post({ rawText: RAW });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(result);
    expect(extractVocabFromText).toHaveBeenCalledTimes(1);
    const [userId, input, openai] = extractVocabFromText.mock.calls[0]!;
    expect(userId).toBe(ME);
    expect(input).toEqual({ rawText: RAW, fillMissing: false });
    expect(openai).toEqual({ fake: "openai" });
  });

  it("chế độ điền phần còn thiếu chỉ bật khi giảng viên yêu cầu đúng true", async () => {
    await post({ rawText: RAW, fillMissing: true });
    expect(extractVocabFromText.mock.calls[0]![1]).toEqual({ rawText: RAW, fillMissing: true });
  });

  it("G2.5.3.2: chưa cấu hình OpenAI → 503", async () => {
    getOpenaiClient.mockRejectedValue(new Error("openai_not_configured"));
    const res = await post({ rawText: RAW });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("openai_not_configured");
    expect(extractVocabFromText).not.toHaveBeenCalled();
  });

  it("G2.5.3.2: vượt trần/hết ví → 429 kèm mã; lỗi sinh/kiểm đầu vào → 400 kèm mã", async () => {
    const { AiTutorError, AiGenerationError } = await import("@feedbackme/core-feedback");
    extractVocabFromText.mockRejectedValueOnce(new AiTutorError("no_token_budget", { remaining: 0 }));
    const a = await post({ rawText: RAW });
    expect(a.status).toBe(429);
    expect((await a.json()).error).toBe("no_token_budget");

    extractVocabFromText.mockRejectedValueOnce(new AiGenerationError("validation_failed", "too_short"));
    const b = await post({ rawText: RAW });
    expect(b.status).toBe(400);
    expect(await b.json()).toMatchObject({ error: "validation_failed", details: "too_short" });

    extractVocabFromText.mockRejectedValueOnce(new AiGenerationError("json_parse_failed"));
    expect((await post({ rawText: RAW })).status).toBe(400);
  });

  it("lỗi không lường trước không bị nuốt (để Next trả 500)", async () => {
    extractVocabFromText.mockRejectedValueOnce(new Error("boom"));
    await expect(post({ rawText: RAW })).rejects.toThrow("boom");
  });
});
