import { describe, expect, it } from "vitest";
import { FIT_MIN_SCALE, FIT_SAFE, fitScaleForBox, frameHeightForContent } from "./limioLiveFit";

describe("fitScaleForBox (tự co slide dài cho vừa khung)", () => {
  it("nội dung nằm gọn trong vùng an toàn thì giữ nguyên (slide ngắn không đổi)", () => {
    expect(fitScaleForBox({ top: 72, bottom: 648, left: 96, right: 1184 })).toBe(1);
    expect(fitScaleForBox({ top: FIT_SAFE.top, bottom: FIT_SAFE.bottom, left: FIT_SAFE.left, right: FIT_SAFE.right })).toBe(1);
  });
  it("hộp rỗng hoặc không hợp lệ thì giữ nguyên", () => {
    expect(fitScaleForBox(null)).toBe(1);
    expect(fitScaleForBox({ top: NaN, bottom: 700, left: 0, right: 100 })).toBe(1);
  });
  it("tràn đáy thì co quanh tâm đúng mức để mép dưới chạm vùng an toàn", () => {
    // đáy ở 760: từ tâm 360 tới đáy là 400, cho phép 320 → k = 0,8
    const k = fitScaleForBox({ top: 134, bottom: 760, left: 200, right: 1000 });
    expect(k).toBeCloseTo(0.8, 5);
    expect(360 + (760 - 360) * k).toBeCloseTo(FIT_SAFE.bottom, 5);
  });
  it("tràn đỉnh thì co theo mép trên", () => {
    expect(fitScaleForBox({ top: -40, bottom: 600, left: 200, right: 1000 })).toBeCloseTo(320 / 400, 5);
  });
  it("tràn ngang thì co theo mép trái/phải", () => {
    const k = fitScaleForBox({ top: 100, bottom: 600, left: 100, right: 1432 });
    expect(k).toBeCloseTo(592 / 792, 5);
    expect(fitScaleForBox({ top: 100, bottom: 600, left: -152, right: 1000 })).toBeCloseTo(592 / 792, 5);
  });
  it("lấy hệ số nhỏ nhất khi tràn nhiều phía", () => {
    const k = fitScaleForBox({ top: 100, bottom: 800, left: -300, right: 1100 });
    expect(k).toBeCloseTo(Math.min(320 / 440, 592 / 940), 5);
  });
  it("không co quá mức tối thiểu dù nội dung dài vô hạn", () => {
    expect(fitScaleForBox({ top: 0, bottom: 5000, left: 0, right: 1280 })).toBe(FIT_MIN_SCALE);
  });
  it("kết quả luôn trong khoảng (0, 1]", () => {
    for (const bottom of [700, 900, 1500]) {
      const k = fitScaleForBox({ top: 100, bottom, left: 100, right: 1100 });
      expect(k).toBeGreaterThan(0);
      expect(k).toBeLessThanOrEqual(1);
    }
  });
});

describe("frameHeightForContent (khung cao thêm khi phóng to để cuộn)", () => {
  it("nội dung vừa khung chuẩn thì giữ 720", () => {
    expect(frameHeightForContent({ top: 72, bottom: 648, left: 96, right: 1184 })).toBe(720);
    expect(frameHeightForContent(null)).toBe(720);
  });
  it("nội dung dài thì khung cao đủ chứa nội dung cộng đệm hai phía", () => {
    expect(frameHeightForContent({ top: 72, bottom: 1000, left: 96, right: 1184 })).toBe(928 + 144);
  });
});
