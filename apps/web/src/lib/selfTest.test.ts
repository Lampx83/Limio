import { describe, expect, it } from "vitest";
import { isSelfTestTitle, selfTestLabel } from "./selfTest";

describe("mini-test cuối bài (Tự kiểm tra)", () => {
  it("nhận quiz theo tên quy ước", () => {
    expect(isSelfTestTitle("Tự kiểm tra · 课文1「看房那天」")).toBe(true);
    expect(isSelfTestTitle("  Tự kiểm tra · Bài 2")).toBe(true);
    expect(isSelfTestTitle("Kiểm tra giữa kỳ")).toBe(false);
    expect(isSelfTestTitle("Tự kiểm tra")).toBe(false);
    expect(isSelfTestTitle(null)).toBe(false);
    expect(isSelfTestTitle(undefined)).toBe(false);
  });

  it("nhãn theo điểm: dưới 60 Cần ôn, 60–85 Nên luyện thêm, từ 85 Vững", () => {
    expect(selfTestLabel(0)).toBe("needs_review");
    expect(selfTestLabel(59.9)).toBe("needs_review");
    expect(selfTestLabel(60)).toBe("practice_more");
    expect(selfTestLabel(68.75)).toBe("practice_more");
    expect(selfTestLabel(84.9)).toBe("practice_more");
    expect(selfTestLabel(85)).toBe("solid");
    expect(selfTestLabel(100)).toBe("solid");
  });

  it("chưa có điểm thì chưa có nhãn", () => {
    expect(selfTestLabel(null)).toBe("no_data");
    expect(selfTestLabel(undefined)).toBe("no_data");
    expect(selfTestLabel(Number.NaN)).toBe("no_data");
  });
});
