import { describe, expect, it } from "vitest";
import { bundleDurationText, isHskBundle, parseHskBookSlug } from "../hskBundles";

describe("isHskBundle", () => {
  it("nhận combo toàn khoá HSK", () => {
    expect(isHskBundle(["hsk-4-quyen-1", "hsk-4-quyen-2"])).toBe(true);
    expect(isHskBundle(["hsk-4-goc", "hsk-5-goc"])).toBe(true);
  });
  it("loại combo lẫn khoá khác hoặc rỗng", () => {
    expect(isHskBundle(["hsk-4-quyen-1", "tieng-anh-a1"])).toBe(false);
    expect(isHskBundle([])).toBe(false);
    expect(isHskBundle(["hskx-4-a"])).toBe(false);
  });
});

describe("bundleDurationText", () => {
  it("nói theo năm khi chia hết 12 tháng", () => {
    expect(bundleDurationText(12, "vi")).toBe("Truy cập 1 năm");
    expect(bundleDurationText(6, "vi")).toBe("Truy cập 6 tháng");
    expect(bundleDurationText(null, "vi")).toBe("Truy cập vĩnh viễn");
    expect(bundleDurationText(24, "en")).toBe("2-year access");
  });
});

describe("parseHskBookSlug", () => {
  it("nhận slug quyển của một cấp", () => {
    expect(parseHskBookSlug("hsk-4-quyen-2")).toEqual({ level: 4, book: 2 });
    expect(parseHskBookSlug("hsk-9-quyen-10")).toEqual({ level: 9, book: 10 });
  });
  it("loại slug khác dạng, cấp ngoài 1–9 và quyển 0", () => {
    expect(parseHskBookSlug("hsk-4-goc")).toBeNull();
    expect(parseHskBookSlug("hsk-10-quyen-1")).toBeNull();
    expect(parseHskBookSlug("hsk-4-quyen-0")).toBeNull();
    expect(parseHskBookSlug("xhsk-4-quyen-1")).toBeNull();
  });
});
