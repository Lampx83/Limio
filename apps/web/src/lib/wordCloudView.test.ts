import { describe, expect, it } from "vitest";
import {
  centerOut,
  DEFAULT_WORD_CLOUD_VIEW,
  normalizeWordCloudView,
  rankWords,
  scaleBetween,
  WORD_CLOUD_VIEWS,
  WORD_CLOUD_VIEW_HINT,
  WORD_CLOUD_VIEW_LABEL,
} from "./wordCloudView";

describe("wordCloudView", () => {
  it("mọi kiểu đều có nhãn và mô tả", () => {
    for (const v of WORD_CLOUD_VIEWS) {
      expect(WORD_CLOUD_VIEW_LABEL[v]).toBeTruthy();
      expect(WORD_CLOUD_VIEW_HINT[v]).toBeTruthy();
    }
  });

  it("giá trị lạ hoặc thiếu rơi về kiểu mặc định (slide cũ chưa có viewStyle)", () => {
    expect(normalizeWordCloudView(undefined)).toBe(DEFAULT_WORD_CLOUD_VIEW);
    expect(normalizeWordCloudView("spiral")).toBe(DEFAULT_WORD_CLOUD_VIEW);
    expect(normalizeWordCloudView(3)).toBe(DEFAULT_WORD_CLOUD_VIEW);
    expect(normalizeWordCloudView("bars")).toBe("bars");
  });

  it("rankWords: sắp giảm dần, cắt theo limit, ratio so với từ nhiều nhất", () => {
    const r = rankWords({ b: 2, a: 4, c: 1, d: 0 }, 2);
    expect(r.map((x) => x.word)).toEqual(["a", "b"]);
    expect(r[0]?.ratio).toBe(1);
    expect(r[1]?.ratio).toBe(0.5);
  });

  it("rankWords: cùng số lượt thì theo chữ cái, không nhảy vị trí giữa các lần vẽ", () => {
    expect(rankWords({ z: 1, a: 1, m: 1 }, 10).map((x) => x.word)).toEqual(["a", "m", "z"]);
  });

  it("rankWords: rỗng thì trả mảng rỗng", () => {
    expect(rankWords({}, 10)).toEqual([]);
  });

  it("centerOut đặt phần tử đầu (nhiều nhất) vào giữa và không mất phần tử nào", () => {
    const out = centerOut([1, 2, 3, 4, 5]);
    expect(out).toHaveLength(5);
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(out[Math.floor(out.length / 2)]).toBe(1);
    expect(centerOut([])).toEqual([]);
  });

  it("scaleBetween kẹp trong khoảng", () => {
    expect(scaleBetween(0, 1, 3)).toBe(1);
    expect(scaleBetween(1, 1, 3)).toBe(3);
    expect(scaleBetween(5, 1, 3)).toBe(3);
    expect(scaleBetween(-1, 1, 3)).toBe(1);
  });
});
