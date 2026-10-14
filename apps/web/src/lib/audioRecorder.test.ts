import { describe, expect, it } from "vitest";
import {
  MAX_RECORD_SECONDS,
  extForRecorderMime,
  formatClock,
  pickRecorderMime,
  recorderErrorText,
} from "@/lib/audioRecorder";

describe("pickRecorderMime — chọn định dạng trình duyệt hỗ trợ (G7a.1)", () => {
  it("ưu tiên webm/opus (Chrome, Firefox, Edge), rồi mp4 (Safari/iPhone)", () => {
    expect(pickRecorderMime(() => true)).toBe("audio/webm;codecs=opus");
    expect(pickRecorderMime((t) => t === "audio/mp4")).toBe("audio/mp4");
    expect(pickRecorderMime((t) => t.startsWith("audio/ogg"))).toBe("audio/ogg;codecs=opus");
  });
  it("không định dạng nào hỗ trợ → undefined (để trình duyệt tự chọn)", () => {
    expect(pickRecorderMime(() => false)).toBeUndefined();
  });
});

describe("extForRecorderMime", () => {
  it("map mime → đuôi file khớp với kho (webm/m4a/ogg)", () => {
    expect(extForRecorderMime("audio/webm;codecs=opus")).toBe("webm");
    expect(extForRecorderMime("audio/mp4")).toBe("m4a");
    expect(extForRecorderMime("audio/ogg;codecs=opus")).toBe("ogg");
    expect(extForRecorderMime("")).toBe("webm");
  });
});

describe("formatClock / giới hạn", () => {
  it("mm:ss", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(75)).toBe("1:15");
    expect(formatClock(180)).toBe("3:00");
  });
  it("tối đa 3 phút", () => {
    expect(MAX_RECORD_SECONDS).toBe(180);
  });
});

describe("recorderErrorText — từ chối quyền micro thì chỉ cách khác", () => {
  it("không cấp quyền → nói cách bật quyền hoặc tải file lên", () => {
    const t = recorderErrorText("NotAllowedError");
    expect(t).toMatch(/quyền micro/i);
    expect(t).toMatch(/tải file/i);
  });
  it("không thấy micro / trình duyệt không hỗ trợ / lỗi khác đều có lời nhắn riêng", () => {
    const set = new Set([
      recorderErrorText("NotFoundError"),
      recorderErrorText("unsupported"),
      recorderErrorText("NotAllowedError"),
      recorderErrorText("Whatever"),
    ]);
    expect(set.size).toBe(4);
  });
});
