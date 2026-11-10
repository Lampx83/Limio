import { describe, expect, it } from "vitest";
import { buildEssayConfig, cleanExplanationAudio, emptyEssayDraft, essayDraftFromConfig } from "./essayQuestionConfig";

// docs/tieu-chi/bai-luyen-tra-loi-bang-giong-noi-va-bai-mau.md — AC3, AC5a.

describe("buildEssayConfig", () => {
  it("câu trống: config rỗng (hai công tắc mặc định bật không được ghi ra)", () => {
    expect(buildEssayConfig(emptyEssayDraft())).toEqual({});
  });

  it("có bài mẫu, tiêu chí, số từ, audio mẫu thì ghi đủ; bài mẫu được cắt khoảng trắng", () => {
    const cfg = buildEssayConfig({
      ...emptyEssayDraft(),
      rubric: "<p>Nêu ít nhất ba mốc thời gian</p>",
      minWords: 40,
      explanation: "  I learned about the first day.  ",
      explanationAudio: "/api/exam-assets/ex-1-abc.mp3",
    });
    expect(cfg).toEqual({
      rubric: "<p>Nêu ít nhất ba mốc thời gian</p>",
      minWords: 40,
      explanation: "I learned about the first day.",
      explanationAudio: "/api/exam-assets/ex-1-abc.mp3",
    });
  });

  it("công tắc chỉ được lưu khi TẮT", () => {
    expect(buildEssayConfig({ ...emptyEssayDraft(), voiceAnswer: false })).toEqual({ voiceAnswer: false });
    expect(buildEssayConfig({ ...emptyEssayDraft(), aiFeedback: false })).toEqual({ aiFeedback: false });
    expect(buildEssayConfig({ ...emptyEssayDraft(), voiceAnswer: false, aiFeedback: false })).toEqual({ voiceAnswer: false, aiFeedback: false });
    expect("voiceAnswer" in buildEssayConfig({ ...emptyEssayDraft(), voiceAnswer: true })).toBe(false);
  });

  it("số từ 0 hoặc âm không được ghi; audio sai đường dẫn bị bỏ (không lọt vào config)", () => {
    const cfg = buildEssayConfig({ ...emptyEssayDraft(), minWords: 0, explanationAudio: "https://evil.example/a.mp3" });
    expect(cfg).toEqual({});
    expect(buildEssayConfig({ ...emptyEssayDraft(), minWords: -3 })).toEqual({});
  });
});

describe("essayDraftFromConfig", () => {
  it("câu cũ chưa có khoá mới: hai công tắc bật, không có audio", () => {
    const d = essayDraftFromConfig({ rubric: "Tiêu chí", minWords: 20 });
    expect(d).toMatchObject({ rubric: "Tiêu chí", minWords: 20, explanation: "", explanationAudio: "", voiceAnswer: true, aiFeedback: true });
  });

  it("đọc lại đúng những gì đã lưu (vòng đi vòng lại không đổi)", () => {
    const saved = {
      rubric: "R",
      minWords: 10,
      explanation: "Mẫu",
      explanationAudio: "/api/exam-assets/a.mp3",
      voiceAnswer: false,
      aiFeedback: false,
    };
    expect(buildEssayConfig(essayDraftFromConfig(saved))).toEqual(saved);
  });

  it("đổi chữ thường của rubric cũ thành HTML qua hàm được truyền", () => {
    expect(essayDraftFromConfig({ rubric: "a" }, (s) => `<p>${s}</p>`).rubric).toBe("<p>a</p>");
  });
});

describe("cleanExplanationAudio", () => {
  it("chỉ nhận /api/exam-assets/<tên tệp>", () => {
    expect(cleanExplanationAudio("/api/exam-assets/x_1-2.mp3")).toBe("/api/exam-assets/x_1-2.mp3");
    for (const bad of ["", "x.mp3", "/api/exam-assets/", "/api/exam-assets/a/b.mp3", "/limio/api/exam-assets/a.mp3", "/api/exam-assets/a.mp3?x=1", null, 5]) {
      expect(cleanExplanationAudio(bad)).toBe("");
    }
  });
});
