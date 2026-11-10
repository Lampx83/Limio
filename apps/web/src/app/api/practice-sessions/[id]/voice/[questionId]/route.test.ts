import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ userId: "u1" as string | null }));
vi.mock("@/lib/session", () => ({ requireUserId: async () => state.userId }));

const context = vi.hoisted(() => vi.fn());
const saveVoice = vi.hoisted(() => vi.fn());
vi.mock("@feedbackme/core-lms", async () => {
  const actual = await vi.importActual<typeof import("@feedbackme/core-lms")>("@feedbackme/core-lms");
  return { ...actual, getPracticeVoiceContext: context, saveVoiceAnswer: saveVoice };
});
const transcribe = vi.hoisted(() => vi.fn());
vi.mock("@feedbackme/core-feedback", async () => {
  const actual = await vi.importActual<typeof import("@feedbackme/core-feedback")>("@feedbackme/core-feedback");
  return { ...actual, transcribePracticeVoice: transcribe };
});
const put = vi.hoisted(() => vi.fn());
const del = vi.hoisted(() => vi.fn());
const storageFor = vi.hoisted(() => vi.fn());
vi.mock("@/lib/storage", () => ({ storageFor }));
vi.mock("@/lib/openaiClient", () => ({ getOpenaiClient: vi.fn(async () => ({})) }));

import { AiTutorError, PracticeFeedbackError } from "@feedbackme/core-feedback";
import { ExamError } from "@feedbackme/core-lms";
import { POST } from "./route";

const METRICS = { wordsPerMinute: 110, longPauses: 1 };

function call(file: File | null | "none" = new File([new Uint8Array([1, 2, 3, 4])], "ghi-am.webm", { type: "audio/webm" })) {
  const form = new FormData();
  if (file !== "none" && file !== null) form.append("file", file);
  return POST(new Request("http://localhost:3000/api/practice-sessions/s1/voice/q1", { method: "POST", body: form }), {
    params: { id: "s1", questionId: "q1" },
  });
}

beforeEach(() => {
  state.userId = "u1";
  context.mockReset().mockResolvedValue({ examId: "e1", courseId: "c1", language: "en", languageMode: true, voiceAnswer: true, aiFeedback: true, previousAudioKey: null });
  transcribe.mockReset().mockResolvedValue({ text: "I learned a lot of firsts", durationSec: 12.5, metrics: METRICS });
  saveVoice.mockReset().mockResolvedValue({ previousAudioKey: null });
  put.mockReset().mockResolvedValue(undefined);
  del.mockReset().mockResolvedValue(undefined);
  storageFor.mockReset().mockReturnValue({ put, delete: del });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("POST /api/practice-sessions/[id]/voice/[questionId]", () => {
  it("chưa đăng nhập → 401, không làm gì", async () => {
    state.userId = null;
    expect((await call()).status).toBe(401);
    expect(context).not.toHaveBeenCalled();
    expect(transcribe).not.toHaveBeenCalled();
  });

  it("thành công: chuyển chữ, ghi tệp vào kho private đúng khoá, lưu câu trả lời kèm số liệu, trả { text, durationSec }", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: "I learned a lot of firsts", durationSec: 12.5 });
    expect(context).toHaveBeenCalledWith("u1", "s1", "q1");
    expect(transcribe).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", sessionId: "s1", questionId: "q1", audio: expect.objectContaining({ mimeType: "audio/webm" }) }),
      expect.objectContaining({ openai: expect.any(Function) }),
    );
    const key = storageFor.mock.calls[0]![0] as { layer: string; key: string };
    expect(key.layer).toBe("private");
    expect(key.key).toMatch(/^practice-answers\/s1\/q1-[0-9a-f]{8}\.webm$/);
    expect(put).toHaveBeenCalledWith(key.key, expect.any(Buffer), "audio/webm");
    expect(saveVoice).toHaveBeenCalledWith("u1", "s1", "q1", {
      text: "I learned a lot of firsts",
      audioKey: key.key,
      audioMeta: { durationSec: 12.5, mimeType: "audio/webm", sizeBytes: 4, metrics: METRICS },
    });
    expect(del).not.toHaveBeenCalled(); // chưa có bản ghi cũ
  });

  it("MIME có tham số codecs vẫn nhận; Safari audio/mp4 lưu đuôi m4a", async () => {
    await call(new File([new Uint8Array([1])], "x.m4a", { type: "audio/mp4" }));
    expect((storageFor.mock.calls[0]![0] as { key: string }).key).toMatch(/\.m4a$/);
    storageFor.mockClear();
    await call(new File([new Uint8Array([1])], "x.webm", { type: "audio/webm;codecs=opus" }));
    expect((storageFor.mock.calls[0]![0] as { key: string }).key).toMatch(/\.webm$/);
  });

  it("có bản ghi cũ: xoá tệp cũ khỏi kho SAU khi lưu; lỗi xoá chỉ ghi log, vẫn 200", async () => {
    saveVoice.mockResolvedValue({ previousAudioKey: "practice-answers/s1/q1-aaaa1111.webm" });
    del.mockRejectedValueOnce(new Error("s3 down"));
    const res = await call();
    expect(res.status).toBe(200);
    expect(del).toHaveBeenCalledWith("practice-answers/s1/q1-aaaa1111.webm");
    expect(console.error).toHaveBeenCalled();
  });

  it("khoá cũ sai dạng (dữ liệu hỏng) không bao giờ thành lệnh xoá tệp khác", async () => {
    saveVoice.mockResolvedValue({ previousAudioKey: "submissions/2026/11/../../../etc/passwd" });
    expect((await call()).status).toBe(200);
    expect(del).not.toHaveBeenCalled();
  });

  it("lưu DB thất bại: xoá tệp vừa ghi (không để tệp mồ côi) và trả lỗi đã ánh xạ", async () => {
    saveVoice.mockRejectedValue(new ExamError("practice_session_closed"));
    const res = await call();
    expect(res.status).toBe(409);
    const key = (storageFor.mock.calls[0]![0] as { key: string }).key;
    expect(del).toHaveBeenCalledWith(key);
  });

  it("quá 25 MB → 413, không chuyển chữ, không ghi tệp", async () => {
    const big = new File([new Uint8Array(25 * 1024 * 1024 + 1)], "ghi-am.webm", { type: "audio/webm" });
    const res = await call(big);
    expect(res.status).toBe(413);
    expect(transcribe).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it("sai MIME (ảnh, video) → 415; thiếu tệp hoặc tệp rỗng → 400", async () => {
    for (const type of ["image/png", "video/mp4", "application/pdf", ""]) {
      expect((await call(new File([new Uint8Array([1])], "x", { type }))).status).toBe(415);
    }
    expect((await call("none")).status).toBe(400);
    expect((await call(new File([], "x.webm", { type: "audio/webm" }))).status).toBe(400);
    expect(transcribe).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it("người lạ / buổi không tồn tại → 404; buổi đã đóng → 409; tắt giọng nói → 400; đều chưa đọc tệp hay gọi AI", async () => {
    context.mockRejectedValueOnce(new ExamError("practice_session_not_found"));
    expect((await call()).status).toBe(404);
    context.mockRejectedValueOnce(new ExamError("practice_session_closed"));
    expect((await call()).status).toBe(409);
    context.mockRejectedValueOnce(new ExamError("validation_failed", { reason: "voice_disabled" }));
    expect((await call()).status).toBe(400);
    expect(transcribe).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it("lỗi AI được ánh xạ: không có tiếng nói 422, hết hạn mức 429, chưa cấu hình AI 503, Whisper lỗi 502; không ghi tệp", async () => {
    transcribe.mockRejectedValueOnce(new PracticeFeedbackError("no_speech"));
    let res = await call();
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("no_speech");
    transcribe.mockRejectedValueOnce(new AiTutorError("daily_token_cap"));
    res = await call();
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("daily_token_cap");
    transcribe.mockRejectedValueOnce(new Error("openai_not_configured"));
    res = await call();
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("openai_not_configured");
    transcribe.mockRejectedValueOnce(new PracticeFeedbackError("stt_failed"));
    expect((await call()).status).toBe(502);
    transcribe.mockRejectedValueOnce(new PracticeFeedbackError("audio_too_long", { seconds: 200, max: 180 }));
    expect((await call()).status).toBe(422);
    expect(put).not.toHaveBeenCalled();
    expect(saveVoice).not.toHaveBeenCalled();
  });
});
