import { describe, expect, it } from "vitest";
import { quizAudioUrlOf } from "./quizAudio";

describe("quizAudioUrlOf — audio của câu hỏi quiz", () => {
  it("nhận đường dẫn audio nội bộ của bài học", () => {
    expect(quizAudioUrlOf({ audioUrl: "/api/lesson-media/audio/abc-123.mp3" })).toBe("/api/lesson-media/audio/abc-123.mp3");
    expect(quizAudioUrlOf({ audioUrl: "  /api/lesson-media/audio/x.mp3  " })).toBe("/api/lesson-media/audio/x.mp3");
  });

  it("bỏ địa chỉ ngoài, đường dẫn lạ và thoát thư mục", () => {
    for (const bad of [
      "https://evil.example/a.mp3",
      "//evil.example/a.mp3",
      "/api/lesson-media/images/a.webp",
      "/api/lesson-media/audio/",
      "/api/lesson-media/audio/../../secret.mp3",
      "/api/lesson-media/audio/a b.mp3",
      "/api/lesson-media/audio/a.mp3?x=1",
      "javascript:alert(1)",
    ]) {
      expect(quizAudioUrlOf({ audioUrl: bad }), bad).toBeNull();
    }
  });

  it("không có extra hoặc audioUrl không phải chuỗi thì không có audio", () => {
    expect(quizAudioUrlOf(null)).toBeNull();
    expect(quizAudioUrlOf(undefined)).toBeNull();
    expect(quizAudioUrlOf({})).toBeNull();
    expect(quizAudioUrlOf({ audioUrl: 5 })).toBeNull();
    expect(quizAudioUrlOf("x")).toBeNull();
  });
});
