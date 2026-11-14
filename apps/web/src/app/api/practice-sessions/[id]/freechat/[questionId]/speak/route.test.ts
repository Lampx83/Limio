import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ userId: "u1" as string | null }));
vi.mock("@/lib/session", () => ({ requireUserId: async () => state.userId }));
const opening = vi.hoisted(() => vi.fn());
const frame = vi.hoisted(() => vi.fn());
vi.mock("@feedbackme/core-feedback", async () => {
  const actual = await vi.importActual<typeof import("@feedbackme/core-feedback")>("@feedbackme/core-feedback");
  return { ...actual, getFreeChatOpening: opening, getFreeChatFrame: frame };
});
const speak = vi.hoisted(() => vi.fn());
vi.mock("@/lib/freeChatSpeech", () => ({ speakPartnerLine: speak }));

import { PracticeFeedbackError } from "@feedbackme/core-feedback";
import { POST } from "./route";

const call = (query = "") => POST(new Request(`http://localhost:3000/x${query}`, { method: "POST" }), { params: { id: "s1", questionId: "q1" } });

beforeEach(() => {
  state.userId = "u1";
  opening.mockReset().mockResolvedValue({ opening: "What would you take?", language: "en" });
  frame.mockReset().mockResolvedValue({ text: "I prefer, because, .", language: "en" });
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

  // docs/tieu-chi/limio-language-ban-ao-scaffolding-moc-1.md AC3
  describe("?frame=<chỉ số> — đọc thử mẫu câu ở màn chuẩn bị", () => {
    it("đọc mẫu câu LẤY TỪ CẤU HÌNH (chỉ gửi chỉ số), không đọc lời mở đầu", async () => {
      const res = await call("?frame=1");
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ speech: { audioChunks: ["QUJD"], contentType: "audio/mpeg" } });
      expect(frame).toHaveBeenCalledWith({ userId: "u1", sessionId: "s1", questionId: "q1", frame: 1 });
      expect(speak).toHaveBeenCalledWith("I prefer, because, .", "en");
      expect(opening).not.toHaveBeenCalled();
    });
    it("chỉ số không phải số nguyên nhỏ (chữ, âm, thập phân, quá dài, rỗng) → 404, không đọc", async () => {
      for (const bad of ["abc", "-1", "1.5", "123", "", "1;2"]) expect((await call(`?frame=${bad}`)).status).toBe(404);
      expect(frame).not.toHaveBeenCalled();
      expect(speak).not.toHaveBeenCalled();
    });
    it("chỉ số ngoài khoảng của cấu hình (lõi ném not_found) → 404", async () => {
      frame.mockRejectedValueOnce(new PracticeFeedbackError("not_found"));
      expect((await call("?frame=7")).status).toBe(404);
      expect(speak).not.toHaveBeenCalled();
    });
    it("cùng điều kiện truy cập với lời mở đầu: chưa đăng nhập 401; nhóm đối chứng 403", async () => {
      state.userId = null;
      expect((await call("?frame=0")).status).toBe(401);
      state.userId = "u1";
      frame.mockRejectedValueOnce(new PracticeFeedbackError("control_group"));
      expect((await call("?frame=0")).status).toBe(403);
      expect(speak).not.toHaveBeenCalled();
    });
    it("đọc lỗi → 200 với speech null", async () => {
      speak.mockResolvedValueOnce(null);
      expect(await (await call("?frame=0")).json()).toEqual({ speech: null });
    });
  });
});
