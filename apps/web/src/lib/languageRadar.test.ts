import { describe, expect, it } from "vitest";
import {
  RADAR_CENTER,
  RADAR_RADIUS,
  languageLabelText,
  radarAltText,
  radarPoint,
} from "@/lib/languageRadar";

/**
 * LANG G3 / G3.4.1 + G3.4.6 — hình học của radar 4 trục. Radar chỉ phản ánh NHÃN
 * (ba vòng), không phản ánh giá trị mastery, nên học viên không đọc được số từ hình.
 */

const dist = (p: { x: number; y: number }) => Math.hypot(p.x - RADAR_CENTER, p.y - RADAR_CENTER);

describe("radarPoint", () => {
  it("bốn trục: Nghe trên, Nói phải, Đọc dưới, Viết trái; 'Vững' nằm ở vòng ngoài", () => {
    const top = radarPoint(0, "solid");
    const right = radarPoint(1, "solid");
    const bottom = radarPoint(2, "solid");
    const left = radarPoint(3, "solid");
    expect(top.x).toBeCloseTo(RADAR_CENTER, 5);
    expect(top.y).toBeCloseTo(RADAR_CENTER - RADAR_RADIUS, 5);
    expect(right.x).toBeCloseTo(RADAR_CENTER + RADAR_RADIUS, 5);
    expect(right.y).toBeCloseTo(RADAR_CENTER, 5);
    expect(bottom.y).toBeCloseTo(RADAR_CENTER + RADAR_RADIUS, 5);
    expect(left.x).toBeCloseTo(RADAR_CENTER - RADAR_RADIUS, 5);
  });

  it("ba vòng cách đều: Cần ôn 1/3, Nên luyện 2/3, Vững 1 bán kính", () => {
    expect(dist(radarPoint(0, "needs_review"))).toBeCloseTo(RADAR_RADIUS / 3, 5);
    expect(dist(radarPoint(0, "practice_more"))).toBeCloseTo((RADAR_RADIUS * 2) / 3, 5);
    expect(dist(radarPoint(0, "solid"))).toBeCloseTo(RADAR_RADIUS, 5);
  });

  it("chưa đủ dữ liệu: điểm gần tâm hơn vòng Cần ôn và được đánh dấu để vẽ rỗng", () => {
    const p = radarPoint(1, "no_data");
    expect(dist(p)).toBeLessThan(RADAR_RADIUS / 3);
    expect(p.hollow).toBe(true);
    expect(radarPoint(1, "solid").hollow).toBe(false);
  });

  it("cùng nhãn luôn cho cùng vị trí (không phụ thuộc giá trị nào khác)", () => {
    expect(radarPoint(2, "practice_more")).toEqual(radarPoint(2, "practice_more"));
  });
});

describe("languageLabelText", () => {
  it("dùng nhãn chung của lộ trình, riêng 'chưa có dữ liệu' đổi thành 'Chưa đủ dữ liệu'", () => {
    expect(languageLabelText("needs_review")).toBe("Cần ôn");
    expect(languageLabelText("practice_more")).toBe("Nên luyện thêm");
    expect(languageLabelText("solid")).toBe("Vững");
    expect(languageLabelText("no_data")).toBe("Chưa đủ dữ liệu");
  });
});

describe("radarAltText — G3.4.6", () => {
  it("đọc được bằng trình đọc màn hình, đúng thứ tự trục, không có số", () => {
    const t = radarAltText([
      { skill: "listening", label: "needs_review" },
      { skill: "speaking", label: "no_data" },
      { skill: "reading", label: "solid" },
      { skill: "writing", label: "practice_more" },
    ]);
    expect(t).toBe("Nghe: Cần ôn. Nói: Chưa đủ dữ liệu. Đọc: Vững. Viết: Nên luyện thêm.");
    expect(t).not.toMatch(/\d|%/);
  });
});
