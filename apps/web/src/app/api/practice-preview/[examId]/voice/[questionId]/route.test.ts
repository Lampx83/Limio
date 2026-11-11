import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ userId: "t1" as string | null }));
vi.mock("@/lib/session", () => ({ requireUserId: async () => state.userId }));

const context = vi.hoisted(() => vi.fn());
vi.mock("@feedbackme/core-lms", async () => {
  const actual = await vi.importActual<typeof import("@feedbackme/core-lms")>("@feedbackme/core-lms");
  return { ...actual, getPreviewVoiceContext: context };
});
const transcribe = vi.hoisted(() => vi.fn());
vi.mock("@feedbackme/core-feedback", async () => {
  const actual = await vi.importActual<typeof import("@feedbackme/core-feedback")>("@feedbackme/core-feedback");
  return { ...actual, transcribePreviewVoice: transcribe };
});
const storageFor = vi.hoisted(() => vi.fn());
vi.mock("@/lib/storage", () => ({ storageFor }));
vi.mock("@/lib/openaiClient", () => ({ getOpenaiClient: vi.fn(async () => ({})) }));

import { AiTutorError, PracticeFeedbackError } from "@feedbackme/core-feedback";
import { ExamError } from "@feedbackme/core-lms";
import { POST } from "./route";

function call(file: File | "none" = new File([new Uint8Array([1, 2, 3, 4])], "ghi-am.webm", { type: "audio/webm" })) {
  const form = new FormData();
  if (file !== "none") form.append("file", file);
  return POST(new Request("http://localhost:3000/api/practice-preview/ex1/voice/q1", { method: "POST", body: form }), {
    params: { examId: "ex1", questionId: "q1" },
  });
}

beforeEach(() => {
  state.userId = "t1";
  context.mockReset().mockResolvedValue({ language: "en" });
  transcribe.mockReset().mockResolvedValue({ text: "I learned a lot of firsts", durationSec: 12.5, metrics: {} });
  storageFor.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("POST /api/practice-preview/[examId]/voice/[questionId]", () => {
  it("chưa đăng nhập → 401, không làm gì", async () => {
    state.userId = null;
    expect((await call()).status).toBe(401);
    expect(context).not.toHaveBeenCalled();
    expect(transcribe).not.toHaveBeenCalled();
  });

  it("chuyển chữ cho giảng viên với ngôn ngữ của khoá, trả { text, durationSec } và KHÔNG ghi gì vào kho tệp", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: "I learned a lot of firsts", durationSec: 12.5 });
    expect(context).toHaveBeenCalledWith("t1", "ex1", "q1");
    expect(transcribe).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "t1", language: "en", audio: expect.objectContaining({ mimeType: "audio/webm" }) }),
      expect.objectContaining({ openai: expect.any(Function) }),
    );
    expect(storageFor).not.toHaveBeenCalled();
  });

  it("kiểm quyền và câu TRƯỚC khi đọc tệp: người không sửa được khoá bị chặn, chưa gọi Whisper", async () => {
    context.mockRejectedValue(new ExamError("exam_not_found"));
    const res = await call();
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(transcribe).not.toHaveBeenCalled();
  });

  it("tệp sai: thiếu tệp 400, định dạng lạ 415, quá lớn 413; chưa gọi Whisper", async () => {
    expect((await call("none")).status).toBe(400);
    expect((await call(new File([new Uint8Array([1])], "x.txt", { type: "text/plain" }))).status).toBe(415);
    expect(transcribe).not.toHaveBeenCalled();
  });

  it("lỗi dịch vụ: hết ví → 429, thiếu tiếng nói → 422, chưa cấu hình OpenAI → 503", async () => {
    transcribe.mockRejectedValueOnce(new AiTutorError("daily_token_cap"));
    expect((await call()).status).toBe(429);
    transcribe.mockRejectedValueOnce(new PracticeFeedbackError("no_speech"));
    expect((await call()).status).toBe(422);
    transcribe.mockRejectedValueOnce(new Error("openai_not_configured"));
    expect((await call()).status).toBe(503);
  });
});
