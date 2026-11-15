import { describe, expect, it } from "vitest";
import { validateContentPayload } from "../contentSchemas";

/**
 * Video tải lên: transcript `.vtt` cùng-origin làm phụ đề `<track>`; `captionLang`/`captionLabel` tuỳ chọn.
 */
describe("video payload — phụ đề (captionLang / captionLabel)", () => {
  const base = {
    url: "/api/lesson-media/videos/u-1790000000000-abcdef0123456789.mp4",
    transcriptUrl: "/api/lesson-media/transcripts/u-1790000000000-abcdef0123456789.vtt",
  };

  it("payload cũ (không có captionLang/captionLabel) vẫn hợp lệ, không thêm field", () => {
    expect(validateContentPayload("video", base)).toEqual(base);
  });

  it("nhận captionLang BCP-47 + captionLabel và giữ lại", () => {
    for (const captionLang of ["en", "vi", "zh-Hans", "pt-BR"]) {
      const out = validateContentPayload("video", { ...base, captionLang, captionLabel: "Tiếng Anh" }) as {
        captionLang?: string;
        captionLabel?: string;
      };
      expect(out.captionLang).toBe(captionLang);
      expect(out.captionLabel).toBe("Tiếng Anh");
    }
  });

  it("từ chối captionLang không phải BCP-47", () => {
    for (const captionLang of ["", "english language", "e", "en_US", "en-"]) {
      expect(() => validateContentPayload("video", { ...base, captionLang })).toThrow();
    }
  });

  it("từ chối captionLabel quá dài", () => {
    expect(() => validateContentPayload("video", { ...base, captionLabel: "x".repeat(61) })).toThrow();
  });
});
