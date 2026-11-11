import { describe, expect, it } from "vitest";
import { practiceAnswerKey, practiceAnswerKeyFromAudioKey } from "./storage-keys";

describe("khoá kho cho bản ghi âm câu mở của Bài luyện", () => {
  it("nằm ở lớp private, dưới practice-answers/<buổi>/", () => {
    expect(practiceAnswerKey("s1", "q1-aaaa1111.webm")).toEqual({ layer: "private", key: "practice-answers/s1/q1-aaaa1111.webm" });
  });
  it("khoá đã lưu trong DB đổi ngược về khoá kho; sai dạng thì null", () => {
    expect(practiceAnswerKeyFromAudioKey("practice-answers/s1/q1-aaaa1111.webm")).toEqual({ layer: "private", key: "practice-answers/s1/q1-aaaa1111.webm" });
    for (const k of ["", "submissions/2026/11/x.webm", "practice-answers/s1/../x.webm", "practice-answers//x.webm", "practice-answers/s1/a/b.webm", "/practice-answers/s1/x.webm"]) {
      expect(practiceAnswerKeyFromAudioKey(k)).toBeNull();
    }
  });
});
