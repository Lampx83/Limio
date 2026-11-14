import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ userId: "u1" as string | null }));
vi.mock("@/lib/session", () => ({ requireUserId: async () => state.userId }));
const opening = vi.hoisted(() => vi.fn());
vi.mock("@feedbackme/core-feedback", async () => {
  const actual = await vi.importActual<typeof import("@feedbackme/core-feedback")>("@feedbackme/core-feedback");
  return { ...actual, getFreeChatOpening: opening };
});
const speak = vi.hoisted(() => vi.fn());
vi.mock("@/lib/freeChatSpeech", () => ({ speakPartnerLine: speak }));

import { PracticeFeedbackError } from "@feedbackme/core-feedback";
import { POST } from "./route";

const call = () => POST(new Request("http://localhost:3000/x", { method: "POST" }), { params: { id: "s1", questionId: "q1" } });

beforeEach(() => {
  state.userId = "u1";
  opening.mockReset().mockResolvedValue({ opening: "What would you take?", language: "en" });
  speak.mockReset().mockResolvedValue({ audioChunks: ["QUJD"], contentType: "audio/mpeg" });
});

describe("POST /api/practice-sessions/[id]/freechat/[questionId]/speak", () => {
  it("chưa đăng nhập → 401, chưa đọc gì", async () => {
    state.userId = null;
    expect((await call()).status).toBe(401);
    expect(opening).not.toHaveBeenCalled();
  });

  it("đọc lời mở đầu LẤY TỪ CẤU HÌNH (không nhận chữ từ trình duyệt), theo ngôn ngữ khoá", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ speech: { audioChunks: ["QUJD"], contentType: "audio/mpeg" } });
    expect(opening).toHaveBeenCalledWith({ userId: "u1", sessionId: "s1", questionId: "q1" });
    expect(speak).toHaveBeenCalledWith("What would you take?", "en");
  });

  it("đọc lỗi → 200 với speech null (vẫn có chữ)", async () => {
    speak.mockResolvedValueOnce(null);
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ speech: null });
  });

  it("không phải câu của mình / buổi đã đóng / nhóm đối chứng bị chặn, không đọc", async () => {
    opening.mockRejectedValueOnce(new PracticeFeedbackError("forbidden"));
    expect((await call()).status).toBe(403);
    opening.mockRejectedValueOnce(new PracticeFeedbackError("control_group"));
    expect((await call()).status).toBe(403);
    opening.mockRejectedValueOnce(new PracticeFeedbackError("session_closed"));
    expect((await call()).status).toBe(409);
    expect(speak).not.toHaveBeenCalled();
  });
});
