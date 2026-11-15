import { describe, expect, it } from "vitest";
import { captionTrackFor, transcriptContentType } from "./captions";

const NATIVE = "/api/lesson-media/videos/u-1790000000000-abcdef0123456789.mp4";
const VTT = "/api/lesson-media/transcripts/u-1790000000000-abcdef0123456789.vtt";

describe("captionTrackFor", () => {
  it("video tải lên + .vtt cùng-origin → track mặc định English", () => {
    expect(captionTrackFor({ url: NATIVE, transcriptUrl: VTT })).toEqual({
      src: VTT,
      srcLang: "en",
      label: "English",
    });
  });

  it("tôn trọng captionLang / captionLabel", () => {
    expect(captionTrackFor({ url: NATIVE, transcriptUrl: VTT, captionLang: "vi" })).toMatchObject({
      srcLang: "vi",
      label: "Vietnamese",
    });
    expect(
      captionTrackFor({ url: NATIVE, transcriptUrl: VTT, captionLang: "vi", captionLabel: "Tiếng Việt" }),
    ).toMatchObject({ srcLang: "vi", label: "Tiếng Việt" });
  });

  it("nhận file .mp4 trực tiếp (URL tuyệt đối) và .vtt có query", () => {
    expect(
      captionTrackFor({ url: "https://cdn.example.com/v.mp4", transcriptUrl: `${VTT}?v=2` }),
    ).not.toBeNull();
  });

  it("video của nhà cung cấp (iframe) → null", () => {
    expect(
      captionTrackFor({ url: "https://www.youtube.com/watch?v=abc12345678", transcriptUrl: VTT }),
    ).toBeNull();
  });

  it("không có transcript, .srt, hoặc transcript không cùng-origin → null", () => {
    expect(captionTrackFor({ url: NATIVE })).toBeNull();
    expect(captionTrackFor({ url: NATIVE, transcriptUrl: VTT.replace(".vtt", ".srt") })).toBeNull();
    expect(captionTrackFor({ url: NATIVE, transcriptUrl: "https://evil.example.com/x.vtt" })).toBeNull();
    expect(captionTrackFor({ url: NATIVE, transcriptUrl: "//evil.example.com/x.vtt" })).toBeNull();
    expect(captionTrackFor({ url: "", transcriptUrl: VTT })).toBeNull();
  });
});

describe("transcriptContentType", () => {
  it(".vtt → text/vtt, .srt → text/plain", () => {
    expect(transcriptContentType("a-1790000000000-ab.vtt")).toBe("text/vtt; charset=utf-8");
    expect(transcriptContentType("a-1790000000000-ab.VTT")).toBe("text/vtt; charset=utf-8");
    expect(transcriptContentType("a-1790000000000-ab.srt")).toBe("text/plain; charset=utf-8");
  });
});
