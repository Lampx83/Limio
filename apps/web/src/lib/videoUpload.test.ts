import { describe, expect, it } from "vitest";
import { resolveVideoMime, videoUploadErrorMessage } from "./videoUpload";

describe("resolveVideoMime", () => {
  it("nhận các loại video đã hỗ trợ theo loại do trình duyệt báo", () => {
    for (const t of ["video/mp4", "video/webm", "video/ogg", "video/quicktime", "video/x-matroska"]) expect(resolveVideoMime(t, "a.bin")).toBe(t);
  });
  it("loại rỗng hoặc octet-stream (Safari, .mkv/.mov) thì dựa vào đuôi tệp, không phân biệt hoa thường", () => {
    expect(resolveVideoMime("", "Bai1.MKV")).toBe("video/x-matroska");
    expect(resolveVideoMime("application/octet-stream", "clip.mov")).toBe("video/quicktime");
    expect(resolveVideoMime("", "clip.m4v")).toBe("video/mp4");
    expect(resolveVideoMime("video/x-m4v", "clip.m4v")).toBe("video/mp4");
  });
  it("loại lạ hoặc đuôi lạ thì từ chối (không nhận chỉ vì đuôi khi trình duyệt đã báo loại khác)", () => {
    expect(resolveVideoMime("", "clip.avi")).toBeNull();
    expect(resolveVideoMime("", "noext")).toBeNull();
    expect(resolveVideoMime("application/pdf", "clip.mp4")).toBeNull();
    expect(resolveVideoMime("image/png", "clip.mkv")).toBeNull();
  });
});

describe("videoUploadErrorMessage", () => {
  it("đổi mã lỗi của route thành câu tiếng Việt", () => {
    expect(videoUploadErrorMessage("file_too_large", 413)).toMatch(/100 MB/);
    expect(videoUploadErrorMessage("unsupported_media_type", 415)).toMatch(/MP4, WebM, MOV, MKV hoặc OGV/);
    expect(videoUploadErrorMessage("unauthorized", 401)).toMatch(/đăng nhập/);
    expect(videoUploadErrorMessage(undefined, 500)).toMatch(/500/);
  });
});
