import { describe, expect, it } from "vitest";
import { AUDIO_MAX_BYTES, AUDIO_MIME_TYPES, IMAGE_MAX_BYTES, IMAGE_MIME_TYPES } from "@feedbackme/core-lms";
import { AUDIO_DIALOG_HINT, AUDIO_LIMIT, IMAGE_LIMIT, VIDEO_DIALOG_HINT, checkAudioFile, checkImageFile, checkVideoFile, formatBytes } from "./mediaLimits";

describe("giới hạn khớp với máy chủ", () => {
  it("ảnh và audio phản chiếu đúng hằng của core-lms", () => {
    expect(IMAGE_LIMIT.maxBytes).toBe(IMAGE_MAX_BYTES);
    expect([...IMAGE_LIMIT.mimes].sort()).toEqual([...IMAGE_MIME_TYPES].sort());
    expect(AUDIO_LIMIT.maxBytes).toBe(AUDIO_MAX_BYTES);
    expect([...AUDIO_LIMIT.mimes].sort()).toEqual([...AUDIO_MIME_TYPES].sort());
  });
});

describe("kiểm tra tệp trước khi tải", () => {
  it("ảnh: nhận đúng loại trong mức; từ chối sai loại và quá nặng bằng tiếng Việt, nêu dung lượng", () => {
    expect(checkImageFile({ type: "image/png", size: 1000 })).toBeNull();
    expect(checkImageFile({ type: "image/svg+xml", size: 1000 })).toMatch(/PNG, JPG, WebP, GIF/);
    expect(checkImageFile({ type: "image/png", size: 6 * 1024 * 1024 })).toMatch(/6 MB.*5 MB/);
  });
  it("audio: nhận mp3/m4a, từ chối loại lạ và quá 25 MB", () => {
    expect(checkAudioFile({ type: "audio/mpeg", size: 1000 })).toBeNull();
    expect(checkAudioFile({ type: "audio/flac", size: 1000 })).toMatch(/MP3/);
    expect(checkAudioFile({ type: "audio/mpeg", size: 26 * 1024 * 1024 })).toMatch(/25 MB/);
  });
  it("video: loại rỗng nhưng đuôi đúng vẫn nhận; quá 100 MB hoặc đuôi lạ thì từ chối", () => {
    expect(checkVideoFile({ type: "", size: 1000, name: "a.mkv" })).toBeNull();
    expect(checkVideoFile({ type: "video/mp4", size: 101 * 1024 * 1024, name: "a.mp4" })).toMatch(/100 MB/);
    expect(checkVideoFile({ type: "", size: 1000, name: "a.avi" })).toMatch(/MP4, WebM, MOV, MKV, OGV/);
  });
});

describe("hiển thị", () => {
  it("câu trong hộp thoại nêu định dạng và dung lượng của từng loại", () => {
    for (const s of ["25 MB", "MP3", "M4A"]) expect(AUDIO_DIALOG_HINT).toContain(s);
    for (const s of ["100 MB", "MP4", "MKV"]) expect(VIDEO_DIALOG_HINT).toContain(s);
  });
  it("formatBytes", () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe("5 MB");
    expect(formatBytes(1536 * 1024)).toBe("1.5 MB");
    expect(formatBytes(900)).toBe("900 B");
  });
});
