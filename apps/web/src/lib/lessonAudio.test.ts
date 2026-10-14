import { describe, expect, it } from "vitest";
import {
  AUDIO_MAX_BYTES,
  AUDIO_UPLOAD_ACCEPT,
  SUPPORTED_AUDIO_MIMES,
  audioMimeForFilename,
  validateAudioUpload,
  withoutHiddenAudioTranscripts,
} from "@/lib/lessonAudio";

/**
 * LANG G1 / AUD.1 — luật nhận file audio của bài học, tách khỏi route để thử
 * được không cần dựng request. Quyết định đã chốt với chủ dự án (2026-10-03):
 * bỏ wav (1 phút stereo 44,1 kHz ≈ 10 MB, nên 10 phút ≈ 106 MB) và giới hạn 50 MB.
 */

describe("danh sách định dạng audio", () => {
  it("chỉ mp3, m4a, ogg, webm — KHÔNG có wav", () => {
    const exts = SUPPORTED_AUDIO_MIMES.map((m) => m.ext).sort();
    expect(exts).toEqual(expect.arrayContaining(["m4a", "mp3", "ogg", "webm"]));
    expect(exts).not.toContain("wav");
    expect(SUPPORTED_AUDIO_MIMES.map((m) => m.mime)).not.toContain("audio/wav");
    expect(SUPPORTED_AUDIO_MIMES.map((m) => m.mime)).not.toContain("audio/x-wav");
  });

  it("giới hạn đúng 50 MB", () => {
    expect(AUDIO_MAX_BYTES).toBe(50 * 1024 * 1024);
  });

  it("chuỗi accept của ô chọn file khớp danh sách và không mời wav", () => {
    for (const ext of ["mp3", "m4a", "ogg", "webm"]) expect(AUDIO_UPLOAD_ACCEPT).toContain(`.${ext}`);
    expect(AUDIO_UPLOAD_ACCEPT).not.toContain("wav");
  });

  it("đuôi file → MIME khi phát lại; đuôi lạ không có MIME", () => {
    expect(audioMimeForFilename("a-1790000000000-ab.mp3")).toBe("audio/mpeg");
    expect(audioMimeForFilename("a-1790000000000-ab.m4a")).toBe("audio/mp4");
    expect(audioMimeForFilename("a-1790000000000-ab.ogg")).toBe("audio/ogg");
    expect(audioMimeForFilename("a-1790000000000-ab.webm")).toBe("audio/webm");
    expect(audioMimeForFilename("a-1790000000000-ab.wav")).toBeNull();
    expect(audioMimeForFilename("a-1790000000000-ab.exe")).toBeNull();
    expect(audioMimeForFilename("không-có-đuôi")).toBeNull();
  });
});

describe("validateAudioUpload", () => {
  it.each([
    ["audio/mpeg", "mp3"],
    ["audio/mp4", "m4a"],
    ["audio/x-m4a", "m4a"],
    ["audio/ogg", "ogg"],
    ["audio/webm", "webm"],
  ])("nhận %s → đuôi .%s", (type, ext) => {
    expect(validateAudioUpload({ size: 1024, type })).toEqual({ ok: true, ext });
  });

  it("AUD.1.2: đúng 50 MB thì nhận, hơn 1 byte thì 413", () => {
    expect(validateAudioUpload({ size: AUDIO_MAX_BYTES, type: "audio/mpeg" })).toMatchObject({ ok: true });
    expect(validateAudioUpload({ size: AUDIO_MAX_BYTES + 1, type: "audio/mpeg" })).toMatchObject({
      ok: false,
      status: 413,
      error: "file_too_large",
    });
  });

  it("AUD.1.3: sai MIME → 415, kể cả wav và video", () => {
    for (const type of ["audio/wav", "audio/x-wav", "video/mp4", "application/octet-stream", ""]) {
      expect(validateAudioUpload({ size: 1024, type })).toMatchObject({
        ok: false,
        status: 415,
        error: "unsupported_media_type",
      });
    }
  });

  it("AUD.1.5: file rỗng → 400 (kiểm trước loại file)", () => {
    expect(validateAudioUpload({ size: 0, type: "audio/mpeg" })).toMatchObject({
      ok: false,
      status: 400,
      error: "validation_failed",
    });
    expect(validateAudioUpload({ size: 0, type: "audio/wav" })).toMatchObject({ ok: false, status: 400 });
  });

  it("lời từ chối 415 liệt kê các MIME được phép để form báo cho giảng viên", () => {
    const r = validateAudioUpload({ size: 1024, type: "audio/wav" });
    if (r.ok) throw new Error("phải bị từ chối");
    expect(r.details).toMatchObject({ allowed: expect.arrayContaining(["audio/mpeg"]) });
  });
});

describe("withoutHiddenAudioTranscripts — AUD.4.6 (chặn rò ở tầng dữ liệu)", () => {
  const item = (payload: Record<string, unknown>, type = "audio") => ({ id: "i1", type, orderIndex: 0, payload });

  it("showTranscript=false: lời thoại bị gỡ khỏi payload TRƯỚC khi gửi xuống component client", () => {
    const [out] = withoutHiddenAudioTranscripts([item({ url: "/a.mp3", transcript: "ĐÁP_ÁN", showTranscript: false })]);
    expect(JSON.stringify(out)).not.toContain("ĐÁP_ÁN");
    expect((out!.payload as Record<string, unknown>).url).toBe("/a.mp3");
  });

  it("showTranscript bật hoặc không khai báo: giữ nguyên lời thoại", () => {
    const [a, b] = withoutHiddenAudioTranscripts([
      item({ url: "/a.mp3", transcript: "A" }),
      item({ url: "/b.mp3", transcript: "B", showTranscript: true }),
    ]);
    expect((a!.payload as Record<string, unknown>).transcript).toBe("A");
    expect((b!.payload as Record<string, unknown>).transcript).toBe("B");
  });

  it("không đụng loại khác và không sửa mảng/đối tượng gốc", () => {
    const original = item({ url: "/a.mp3", transcript: "X", showTranscript: false });
    const md = item({ body: "transcript: giữ", showTranscript: false }, "markdown");
    const out = withoutHiddenAudioTranscripts([original, md]);
    expect((original.payload as Record<string, unknown>).transcript).toBe("X");
    expect(out[1]).toBe(md);
  });

  it("payload rỗng hoặc không phải object không làm hỏng trang", () => {
    expect(() => withoutHiddenAudioTranscripts([{ id: "i", type: "audio", orderIndex: 0, payload: null }])).not.toThrow();
  });
});
