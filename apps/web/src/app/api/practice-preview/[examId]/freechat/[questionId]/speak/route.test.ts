import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ userId: "t1" as string | null }));
vi.mock("@/lib/session", () => ({ requireUserId: async () => state.userId }));
const preview = vi.hoisted(() => vi.fn());
vi.mock("@feedbackme/core-lms", async () => {
  const actual = await vi.importActual<typeof import("@feedbackme/core-lms")>("@feedbackme/core-lms");
  return { ...actual, getPreviewFreeChatContext: preview };
});
const speak = vi.hoisted(() => vi.fn());
vi.mock("@/lib/freeChatSpeech", () => ({ speakPartnerLine: speak }));

import { POST } from "./route";

// docs/tieu-chi/limio-language-ban-ao-scaffolding-moc-1.md AC3: xem thử của giảng viên có đủ nút nghe thử mẫu câu.
const call = (query = "") => POST(new Request(`http://localhost:3000/x${query}`, { method: "POST" }), { params: { examId: "e1", questionId: "q1" } });
const FREECHAT = {
  scenario: "Choose what to take.",
  opening: "What would you take?",
  scaffold: { frames: [{ en: "I would take ___ because ___.", vi: "" }, { en: "What about you?", vi: "" }] },
};

beforeEach(() => {
  state.userId = "t1";
  preview.mockReset().mockResolvedValue({ freechat: FREECHAT, language: "en", levelBand: null });
  speak.mockReset().mockResolvedValue({ audioChunks: ["QUJD"], contentType: "audio/mpeg" });
});

describe("POST /api/practice-preview/[examId]/freechat/[questionId]/speak", () => {
  it("chưa đăng nhập → 401", async () => {
    state.userId = null;
    expect((await call()).status).toBe(401);
    expect(speak).not.toHaveBeenCalled();
  });
  it("không có ?frame: đọc lời mở đầu từ cấu hình", async () => {
    await call();
    expect(speak).toHaveBeenCalledWith("What would you take?", "en");
  });
  it("?frame=0: đọc mẫu câu từ cấu hình, chỗ trống thành quãng nghỉ", async () => {
    const res = await call("?frame=0");
    expect(res.status).toBe(200);
    expect(speak).toHaveBeenCalledWith("I would take, because, .", "en");
  });
  it("?frame sai (không phải số, ngoài khoảng, phiếu không có scaffold) → 404, không đọc", async () => {
    for (const q of ["?frame=abc", "?frame=-1", "?frame=2", "?frame=99"]) expect((await call(q)).status).toBe(404);
    preview.mockResolvedValueOnce({ freechat: { scenario: "x", opening: "y" }, language: "en", levelBand: null });
    expect((await call("?frame=0")).status).toBe(404);
    expect(speak).not.toHaveBeenCalled();
  });
});
