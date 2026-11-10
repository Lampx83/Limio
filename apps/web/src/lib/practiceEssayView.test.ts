import { describe, expect, it } from "vitest";
import {
  essayFeedbackEnabled,
  essayVoiceEnabled,
  feedbackErrorMessage,
  parseFeedback,
  sampleAudioOf,
  sampleTextOf,
  voiceErrorMessage,
} from "./practiceEssayView";

describe("parseFeedback", () => {
  it("đọc góp ý hợp lệ, bỏ mục sai dạng, mức/tiêu chí lạ", () => {
    const f = parseFeedback({
      summary: "  Good.  ",
      criteria: [
        { key: "task", level: "good", comment: "ok" },
        { key: "grammar", level: "good", comment: "lạ" },
        { key: "content", level: "A+", comment: "lạ" },
        null,
      ],
      errors: [{ category: "grammar", quote: "a", correction: "b", explanation: "c" }, { quote: "", correction: "x" }, "x"],
      nextSteps: ["Retell", "", 3],
      viaVoice: true,
    });
    expect(f).toEqual({
      summary: "Good.",
      criteria: [{ key: "task", level: "good", comment: "ok" }],
      errors: [{ category: "grammar", quote: "a", correction: "b", explanation: "c" }],
      nextSteps: ["Retell"],
      viaVoice: true,
    });
  });
  it("không có gì đáng hiện thì null (không vẽ khối rỗng)", () => {
    for (const v of [null, undefined, "x", 5, [], {}, { criteria: "x", errors: [1] }]) expect(parseFeedback(v)).toBeNull();
  });
  it("không bao giờ mang theo toạ độ nội bộ", () => {
    const f = parseFeedback({ summary: "s", coding: { level: "task" }, dropped: 3 }) as unknown as Record<string, unknown>;
    expect(f).not.toHaveProperty("coding");
    expect(f).not.toHaveProperty("dropped");
  });
});

describe("bài mẫu và công tắc", () => {
  it("sampleTextOf: chữ đã cắt; rỗng/không phải chữ → null", () => {
    expect(sampleTextOf({ explanation: "  a\nb " })).toBe("a\nb");
    for (const c of [{}, { explanation: "  " }, { explanation: 3 }, null]) expect(sampleTextOf(c)).toBeNull();
  });
  it("sampleAudioOf chỉ nhận tệp của kho đề", () => {
    expect(sampleAudioOf({ explanationAudio: "/api/exam-assets/s-1.m4a" })).toBe("/api/exam-assets/s-1.m4a");
    for (const a of ["https://x.test/a.mp3", "/api/exam-assets/../x.mp3", "/api/lesson-media/audio/x.mp3", "", 5, undefined]) expect(sampleAudioOf({ explanationAudio: a })).toBeNull();
  });
  it("công tắc mặc định bật, chỉ tắt khi đúng false", () => {
    expect(essayVoiceEnabled({})).toBe(true);
    expect(essayVoiceEnabled({ voiceAnswer: false })).toBe(false);
    expect(essayFeedbackEnabled({})).toBe(true);
    expect(essayFeedbackEnabled({ aiFeedback: false })).toBe(false);
  });
});

describe("lời nhắn lỗi", () => {
  it("giọng nói: mỗi mã có lời nhắn tiếng Việt và nhắc ô gõ khi cần", () => {
    expect(voiceErrorMessage("daily_token_cap")).toContain("Hạn mức AI");
    expect(voiceErrorMessage("no_budget_x")).toContain("Chưa dùng được bản ghi này");
    for (const c of ["openai_not_configured", "no_speech", "audio_too_long", "stt_failed", "unsupported_media_type", "network"]) expect(voiceErrorMessage(c).length).toBeGreaterThan(10);
  });
  it("góp ý: control_group và không lỗi → null; nhắc bài mẫu chỉ khi có bài mẫu", () => {
    expect(feedbackErrorMessage(undefined, true)).toBeNull();
    expect(feedbackErrorMessage("control_group", true)).toBeNull();
    expect(feedbackErrorMessage("quota", true)).toContain("bài mẫu");
    expect(feedbackErrorMessage("quota", false)).not.toContain("bài mẫu");
    expect(feedbackErrorMessage("failed", true)).toContain("Kiểm tra lại");
  });
});
