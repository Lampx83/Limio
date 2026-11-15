import { describe, expect, it } from "vitest";
import { missingVoice, requiredRoles } from "./voiceRoles";

// docs/tieu-chi/slide-giang-song-ngu.md V3, T4.
describe("vai giọng bắt buộc", () => {
  it("lời giảng không có tiếng Anh chỉ cần giảng viên; podcast cần hai người dẫn", () => {
    expect(requiredRoles("lecture")).toEqual(["lecturer"]);
    expect(requiredRoles("lecture", false)).toEqual(["lecturer"]);
    expect(requiredRoles("podcast")).toEqual(["A", "B"]);
  });
  it("lời giảng có tiếng Anh cần thêm giọng en; podcast không đổi", () => {
    expect(requiredRoles("lecture", true)).toEqual(["lecturer", "en"]);
    expect(requiredRoles("podcast", true)).toEqual(["A", "B"]);
  });
  it("báo thiếu đúng vai, theo thứ tự; chuỗi rỗng coi là thiếu", () => {
    expect(missingVoice("lecture", { lecturer: "baotrang" }, true)).toBe("en");
    expect(missingVoice("lecture", { lecturer: "baotrang", en: "  " }, true)).toBe("en");
    expect(missingVoice("lecture", { en: "af_heart" }, true)).toBe("lecturer");
    expect(missingVoice("lecture", { lecturer: "baotrang", en: "af_heart" }, true)).toBeNull();
  });
  it("không có tiếng Anh thì không đòi giọng en", () => {
    expect(missingVoice("lecture", { lecturer: "baotrang" })).toBeNull();
  });
});
