import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ userId: "u1" as string | null }));
vi.mock("@/lib/session", () => ({ requireUserId: async () => state.userId }));

const context = vi.hoisted(() => vi.fn());
vi.mock("@feedbackme/core-lms", async () => {
  const actual = await vi.importActual<typeof import("@feedbackme/core-lms")>("@feedbackme/core-lms");
  return { ...actual, getPracticeVoiceContext: context };
});
const transcribe = vi.hoisted(() => vi.fn());
vi.mock("@feedbackme/core-feedback", async () => {
  const actual = await vi.importActual<typeof import("@feedbackme/core-feedback")>("@feedbackme/core-feedback");
  return { ...actual, transcribeRolePlayTurn: transcribe };
});
vi.mock("@/lib/openaiClient", () => ({ getOpenaiClient: vi.fn(async () => ({})) }));

import { PracticeFeedbackError } from "@feedbackme/core-feedback";
import { ExamError } from "@feedbackme/core-lms";
import { POST } from "./route";

function call(opts: { turn?: string | null; file?: File | "none" } = {}) {
  const form = new FormData();
  if (opts.file !== "none") form.append("file", opts.file ?? new File([new Uint8Array([1, 2, 3])], "x.webm", { type: "audio/webm" }));
  const turn = opts.turn === undefined ? "2" : opts.turn;
  const qs = turn === null ? "" : `?turn=${turn}`;
  return POST(new Request(`http://localhost:3000/api/practice-sessions/s1/roleplay/q1${qs}`, { method: "POST", body: form }), {
    params: { id: "s1", questionId: "q1" },
  });
}

beforeEach(() => {
  state.userId = "u1";
  context.mockReset().mockResolvedValue({});
  transcribe.mockReset().mockResolvedValue({ text: "I was thinking the same thing", durationSec: 3.2, metrics: {} });
});

describe("POST /api/practice-sessions/[id]/roleplay/[questionId] — chuyển chữ một lượt", () => {
  it("chưa đăng nhập → 401, không làm gì", async () => {
    state.userId = null;
    expect((await call()).status).toBe(401);
    expect(transcribe).not.toHaveBeenCalled();
  });

  it("thành công: chỉ trả { text, durationSec }; không có gì lưu (route không gọi kho tệp hay lưu câu trả lời)", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: "I was thinking the same thing", durationSec: 3.2 });
    expect(context).toHaveBeenCalledWith("u1", "s1", "q1");
    expect(transcribe).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", sessionId: "s1", questionId: "q1", turnIndex: 2, audio: expect.objectContaining({ mimeType: "audio/webm" }) }),
      expect.objectContaining({ openai: expect.any(Function) }),
    );
  });

  it("thiếu hoặc sai số lượt → 400, chưa chuyển chữ", async () => {
    for (const turn of [null, "x", "-1", "40", "1.5"]) {
      expect((await call({ turn })).status).toBe(400);
    }
    expect(transcribe).not.toHaveBeenCalled();
  });

  it("không có tệp → 400; sai định dạng → 415", async () => {
    expect((await call({ file: "none" })).status).toBe(400);
    expect((await call({ file: new File([new Uint8Array([1])], "x.txt", { type: "text/plain" }) })).status).toBe(415);
    expect(transcribe).not.toHaveBeenCalled();
  });

  it("buổi/câu không hợp lệ (ExamError) hoặc câu không phải hội thoại đóng vai thì báo lỗi, không 500", async () => {
    context.mockRejectedValueOnce(new ExamError("practice_session_not_found"));
    expect((await call()).status).toBeLessThan(500);
    transcribe.mockRejectedValueOnce(new PracticeFeedbackError("not_essay"));
    expect((await call()).status).toBeLessThan(500);
  });
});
