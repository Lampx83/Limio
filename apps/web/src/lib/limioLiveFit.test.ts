import { describe, expect, it } from "vitest";
import {
  FIT_MIN_SCALE,
  FIT_SAFE,
  FONT_STEPS,
  betterFit,
  boxFits,
  cardHeadingPx,
  fitScaleForBox,
  frameHeightForContent,
  imageArtWidth,
  keepHyphenated,
  logoShiftFor,
  logoShiftPx,
  pickFontStep,
  safeAreaFor,
  titleFontPx,
  type ContentBox,
  type LogoBand,
} from "./limioLiveFit";
import { fitFontSize } from "./limioLiveSlides";

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

const LOGO_TOP: LogoBand = { pos: "t", heightPx: 64, marginPx: 36 };
const LOGO_BOTTOM: LogoBand = { pos: "b", heightPx: 64, marginPx: 36 };

describe("chỗ cho logo (không thu nhỏ slide)", () => {
  it("không có logo thì vùng an toàn như thường, không dịch", () => {
    expect(safeAreaFor(null)).toEqual(FIT_SAFE);
    expect(logoShiftPx(null)).toBe(0);
  });
  it("logo trên: vùng an toàn bắt đầu dưới logo, chỉ mép trên đổi", () => {
    const s = safeAreaFor(LOGO_TOP);
    expect(s.top).toBe(36 + 64 + 12);
    expect({ ...s, top: FIT_SAFE.top }).toEqual(FIT_SAFE);
  });
  it("logo dưới: chỉ mép dưới lùi lên", () => {
    const s = safeAreaFor(LOGO_BOTTOM);
    expect(s.bottom).toBe(720 - 36 - 64 - 12);
    expect(s.top).toBe(FIT_SAFE.top);
  });
  it("dịch khung vừa đủ để chữ ở mép đệm 72 px nằm dưới logo", () => {
    const shift = logoShiftPx(LOGO_TOP);
    expect(shift).toBe(44);
    expect(shift + 72).toBeGreaterThanOrEqual(safeAreaFor(LOGO_TOP).top);
    expect(logoShiftPx({ ...LOGO_TOP, heightPx: 92 })).toBeGreaterThan(shift);
    expect(logoShiftPx({ ...LOGO_TOP, heightPx: 10 })).toBe(0);
  });
  it("dịch đúng phần nội dung lấn vào dải logo; khối không chạm thì không dịch", () => {
    // tiêu đề sát mép trên (72) với logo trên: vùng an toàn bắt đầu ở 112 → dịch 40
    expect(logoShiftFor({ top: 72, bottom: 600, left: 96, right: 1184 }, LOGO_TOP)).toBe(40);
    expect(logoShiftFor({ top: 200, bottom: 520, left: 120, right: 1100 }, LOGO_TOP)).toBe(0);
    // bìa có đệm 64: chữ người trình bày chạm 656 với logo dưới (vùng an toàn tới 608) → dịch 48
    expect(logoShiftFor({ top: 64, bottom: 656, left: 140, right: 850 }, LOGO_BOTTOM)).toBe(48);
    expect(logoShiftFor({ top: 72, bottom: 560, left: 96, right: 1184 }, LOGO_BOTTOM)).toBe(0);
    expect(logoShiftFor(null, LOGO_TOP)).toBe(0);
    expect(logoShiftFor({ top: 0, bottom: 720, left: 0, right: 1280 }, null)).toBe(0);
  });
});

describe("pickFontStep (giảm cỡ chữ theo bậc thay vì thu cả khối)", () => {
  // Giả lập: chiều cao nội dung tỉ lệ với cỡ chữ, căn trên ở 72.
  const tall = (h: number) => (fs: number): ContentBox => ({ top: 72, bottom: 72 + h * fs, left: 96, right: 1184 });

  it("vừa sẵn thì giữ cỡ gốc", () => {
    expect(pickFontStep(tall(500))).toMatchObject({ fs: 1, fits: true });
  });
  it("chọn bậc lớn nhất vừa vùng an toàn", () => {
    // cần 72 + 700·fs ≤ 680 → fs ≤ 0,868 → bậc 0,86
    expect(pickFontStep(tall(700))).toMatchObject({ fs: 0.86, fits: true });
  });
  it("vùng an toàn hẹp hơn (logo dưới) thì xuống bậc thấp hơn", () => {
    expect(pickFontStep(tall(700), safeAreaFor(LOGO_BOTTOM)).fs).toBeLessThan(0.86);
  });
  it("bậc cuối vẫn tràn thì báo không vừa để bên gọi thu cả khối", () => {
    const r = pickFontStep(tall(2000));
    expect(r.fs).toBe(FONT_STEPS[FONT_STEPS.length - 1]);
    expect(r.fits).toBe(false);
    expect(fitScaleForBox(r.box)).toBeLessThan(1);
  });
  it("đo theo đúng thứ tự bậc, dừng ngay khi vừa", () => {
    const seen: number[] = [];
    pickFontStep((fs) => (seen.push(fs), tall(640)(fs)));
    expect(seen).toEqual([1, 0.93]);
  });
  it("bậc giảm dần từ 1", () => {
    expect(FONT_STEPS[0]).toBe(1);
    for (let i = 1; i < FONT_STEPS.length; i++) expect(FONT_STEPS[i]).toBeLessThan(FONT_STEPS[i - 1]!);
  });
  it("betterFit: ưu tiên cách vừa khung, rồi cách có chữ lớn hơn; ngang nhau giữ cách đầu", () => {
    const a = { fs: 0.62, fits: true, box: null }, b = { fs: 0.74, fits: true, box: null }, c = { fs: 0.93, fits: false, box: null };
    expect(betterFit(a, b)).toBe(b);
    expect(betterFit(b, a)).toBe(b);
    expect(betterFit(a, c)).toBe(a);
    expect(betterFit(a, { ...a })).toBe(a);
  });
  it("boxFits", () => {
    expect(boxFits(null)).toBe(true);
    expect(boxFits({ top: 72, bottom: 648, left: 96, right: 1184 })).toBe(true);
    expect(boxFits({ top: 72, bottom: 700, left: 96, right: 1184 })).toBe(false);
  });
});

describe("cỡ và bề rộng theo nội dung", () => {
  it("tiêu đề vừa một dòng ở ≥ 80% cỡ lớn nhất thì dùng một dòng", () => {
    const px = titleFontPx("Ba Giải Pháp Công Nghệ Tiêu Biểu", { maxPx: 72, widthPx: 1088, maxLines: 2 });
    expect(px).toBeLessThan(72);
    expect(px).toBeGreaterThanOrEqual(58);
  });
  it("tiêu đề ngắn giữ cỡ lớn nhất; tiêu đề quá dài cho một dòng thì như cũ (hai dòng)", () => {
    expect(titleFontPx("Học qua dự án", { maxPx: 72, widthPx: 1088, maxLines: 2 })).toBe(72);
    const long = "Phản hồi chung chung và phản hồi cụ thể trong lớp học trực tuyến";
    expect(titleFontPx(long, { maxPx: 72, widthPx: 1088, maxLines: 2 })).toBe(fitFontSize(long, { maxPx: 72, widthPx: 1088, maxLines: 2 }).px);
  });
  it("tiêu đề thẻ: từ dài nhất vừa một dòng trong thẻ, trong khoảng 28–40 px", () => {
    const px = cardHeadingPx(["3D/XR (YooTek)", "STEM-Robotics (HUNA)", "AI-Gamification (Zep Quiz)"], 3);
    // thẻ 3 cột rộng ≈ 295 px bên trong; "AI-Gamification" 15 ký tự × 0,6 × px ≤ 295
    expect(15 * 0.6 * px).toBeLessThanOrEqual(296);
    expect(px).toBeGreaterThanOrEqual(28);
    expect(cardHeadingPx(["Nội dung", "Tương tác"], 3)).toBe(40);
    expect(cardHeadingPx(["Siêuuuuuuuuuuuuuuuuuuuuuudài"], 4)).toBe(28);
  });
  it("ô hình hẹp dần khi chữ dài", () => {
    expect(imageArtWidth(100)).toBeGreaterThan(imageArtWidth(250));
    expect(imageArtWidth(250)).toBeGreaterThan(imageArtWidth(400));
  });
  it("không ngắt dòng sau gạch nối giữa hai chữ; gạch đứng riêng giữ nguyên", () => {
    expect(keepHyphenated("STEM-Robotics")).toBe("STEM-\u2060Robotics");
    expect(keepHyphenated("AI-Gamification và 3D-XR")).toBe("AI-\u2060Gamification và 3D-\u2060XR");
    expect(keepHyphenated("Trước - sau")).toBe("Trước - sau");
    expect(keepHyphenated("Đồng-hành")).toBe("Đồng-\u2060hành");
  });
});
