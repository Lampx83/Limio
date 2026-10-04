import { describe, expect, it } from "vitest";
import { describeSpeakingError, SPEAKING_NOTICE } from "@/lib/speakingFeedbackText";
import { parseAssignmentMediaFilename, mimeForAudioFilename } from "@/lib/submissionAudio";

describe("describeSpeakingError (không thất bại lặng lẽ)", () => {
  it("mỗi mã lỗi của G7 có lời nhắn riêng, khác lời nhắn mặc định", () => {
    const fallback = describeSpeakingError("???");
    for (const code of [
      "no_token_budget", "global_token_cap", "rate_limited", "audio_missing", "audio_not_hosted", "audio_too_large",
      "audio_too_long", "no_speech", "stt_failed", "control_group", "not_language_course", "forbidden",
      "submission_not_found", "openai_not_configured", "openai_error", "unauthorized",
    ]) {
      expect(describeSpeakingError(code), code).not.toBe(fallback);
    }
  });
  it("hết ví nói rõ là THÁNG; im lặng nói rõ không nghe thấy tiếng; quá dài nói rõ 3 phút", () => {
    expect(describeSpeakingError("no_token_budget")).toMatch(/hết lượt AI của tháng/);
    expect(describeSpeakingError("no_speech")).toMatch(/không nghe thấy/i);
    expect(describeSpeakingError("audio_too_long")).toMatch(/3 phút/);
  });
  it("lỗi Whisper nói rõ chưa bị trừ lượt", () => {
    expect(describeSpeakingError("stt_failed")).toMatch(/chưa bị trừ/);
  });
  it("ghi chú giới hạn phát âm cố định (G7c.1)", () => {
    expect(SPEAKING_NOTICE).toMatch(/không chấm được phát âm/i);
    expect(SPEAKING_NOTICE).toMatch(/giảng viên nghe/i);
  });
});

describe("parseAssignmentMediaFilename — chỉ nhận file của kho hệ thống", () => {
  it("nhận đường dẫn tương đối và URL tuyệt đối trỏ vào /api/assignment-media/", () => {
    expect(parseAssignmentMediaFilename("/api/assignment-media/u1-1700000000000-abcd1234.webm")).toBe("u1-1700000000000-abcd1234.webm");
    expect(parseAssignmentMediaFilename("https://limio.vn/api/assignment-media/u1-1700000000000-abcd1234.m4a")).toBe("u1-1700000000000-abcd1234.m4a");
    expect(parseAssignmentMediaFilename("https://limio.vn/base/api/assignment-media/u1-1700000000000-abcd1234.mp3?x=1")).toBe("u1-1700000000000-abcd1234.mp3");
  });
  it("từ chối URL ngoài, tên có dấu gạch lên thư mục, hoặc không có tên", () => {
    expect(parseAssignmentMediaFilename("https://evil.example.com/a.mp3")).toBeNull();
    expect(parseAssignmentMediaFilename("/api/assignment-media/../secret.txt")).toBeNull();
    expect(parseAssignmentMediaFilename("/api/assignment-media/")).toBeNull();
    expect(parseAssignmentMediaFilename("")).toBeNull();
  });
});

describe("mimeForAudioFilename", () => {
  it("nhận webm/ogg/mp3/wav/m4a; không phải audio thì null", () => {
    expect(mimeForAudioFilename("a.webm")).toBe("audio/webm");
    expect(mimeForAudioFilename("a.m4a")).toBe("audio/mp4");
    expect(mimeForAudioFilename("a.mp3")).toBe("audio/mpeg");
    expect(mimeForAudioFilename("a.png")).toBeNull();
  });
});
