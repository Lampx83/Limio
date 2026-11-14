import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ userId: "u1" as string | null }));
vi.mock("@/lib/session", () => ({ requireUserId: async () => state.userId }));
const run = vi.hoisted(() => vi.fn());
vi.mock("@feedbackme/core-feedback", async () => {
  const actual = await vi.importActual<typeof import("@feedbackme/core-feedback")>("@feedbackme/core-feedback");
  return { ...actual, runFreeChatTurn: run };
});
vi.mock("@/lib/openaiClient", () => ({ getOpenaiClient: vi.fn(async () => ({})) }));
const speak = vi.hoisted(() => vi.fn());
vi.mock("@/lib/freeChatSpeech", () => ({ speakPartnerLine: speak }));

import { AiTutorError, PracticeFeedbackError } from "@feedbackme/core-feedback";
import { POST } from "./route";

const call = (body: unknown | "bad") =>
  POST(new Request("http://localhost:3000/api/practice-sessions/s1/freechat/q1", { method: "POST", body: body === "bad" ? "{not json" : JSON.stringify(body) }), {
    params: { id: "s1", questionId: "q1" },
  });

beforeEach(() => {
  state.userId = "u1";
  run.mockReset().mockResolvedValue({ reply: "Why that?", turn: 1, maxTurns: 8, language: "en" });
  speak.mockReset().mockResolvedValue({ audioChunks: ["QUJD"], contentType: "audio/mpeg" });
});

describe("POST /api/practice-sessions/[id]/freechat/[questionId]", () => {
  it("chưa đăng nhập → 401; JSON hỏng → 400, chưa gọi", async () => {
    state.userId = null;
    expect((await call({ message: "Hi" })).status).toBe(401);
    state.userId = "u1";
    expect((await call("bad")).status).toBe(400);
    expect(run).not.toHaveBeenCalled();
  });

  it("thành công: trả { reply, turn, maxTurns, speech }; giọng đọc đúng lời bạn ảo theo ngôn ngữ khoá; truyền đúng người, buổi, câu, lịch sử và lời nhắn", async () => {
    const hist = [{ role: "learner", text: "A" }, { role: "partner", text: "B" }];
    const res = await call({ history: hist, message: "Hello" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reply: "Why that?", turn: 1, maxTurns: 8, speech: { audioChunks: ["QUJD"], contentType: "audio/mpeg" } });
    expect(speak).toHaveBeenCalledWith("Why that?", "en");
    expect(run).toHaveBeenCalledWith(
      { userId: "u1", sessionId: "s1", questionId: "q1", history: hist, message: "Hello" },
      expect.objectContaining({ openai: expect.any(Function) }),
    );
  });

  it("đọc giọng lỗi (null) thì vẫn trả chữ với speech null", async () => {
    speak.mockResolvedValueOnce(null);
    const res = await call({ message: "Hi" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reply: "Why that?", turn: 1, maxTurns: 8, speech: null });
  });

  it("thiếu history thì coi là rỗng", async () => {
    await call({ message: "Hi" });
    expect(run.mock.calls[0]![0].history).toEqual([]);
  });

  it("lời nhắn sai → 422; hết lượt → 409; ví hết → 429; mô hình lỗi → 502; không phải câu freechat → 400", async () => {
    run.mockRejectedValueOnce(new PracticeFeedbackError("message_invalid"));
    expect((await call({ message: "" })).status).toBe(422);
    run.mockRejectedValueOnce(new PracticeFeedbackError("turn_limit"));
    expect((await call({ message: "x" })).status).toBe(409);
    run.mockRejectedValueOnce(new AiTutorError("daily_token_cap"));
    expect((await call({ message: "x" })).status).toBe(429);
    run.mockRejectedValueOnce(new AiTutorError("openai_error", "boom"));
    expect((await call({ message: "x" })).status).toBe(502);
    run.mockRejectedValueOnce(new PracticeFeedbackError("not_essay"));
    expect((await call({ message: "x" })).status).toBe(400);
  });

  it("thiếu cấu hình AI → 503 openai_not_configured", async () => {
    run.mockRejectedValueOnce(new Error("openai_not_configured"));
    const res = await call({ message: "x" });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "openai_not_configured" });
  });
});
