import { describe, expect, it } from "vitest";
import { RELIABILITY_MIN_ATTEMPTS, reliabilityFromMatrix } from "./reliability";

/** 6 bài × 4 câu nhị phân; tổng điểm mỗi bài = [4,3,3,2,1,0]. */
const consistent = [
  [1, 1, 1, 1],
  [1, 1, 1, 0],
  [1, 1, 0, 1],
  [1, 0, 0, 1],
  [0, 0, 1, 0],
  [0, 0, 0, 0],
];

describe("reliabilityFromMatrix", () => {
  it("tính α theo phương sai của TỔNG điểm (không phải trung bình)", () => {
    const sums = [4, 3, 3, 2, 1, 0];
    const mean = sums.reduce((a, b) => a + b, 0) / 6;
    const totalVar = sums.reduce((a, x) => a + (x - mean) ** 2, 0) / 6;
    let itemVar = 0;
    for (let q = 0; q < 4; q++) {
      const col = consistent.map((r) => r[q]!);
      const m = col.reduce((a, b) => a + b, 0) / 6;
      itemVar += col.reduce((a, x) => a + (x - m) ** 2, 0) / 6;
    }
    const expected = Math.round((4 / 3) * (1 - itemVar / totalVar) * 100) / 100;

    const r = reliabilityFromMatrix(consistent)!;
    expect(r.alpha).toBe(expected);
    expect(r.alpha).toBeGreaterThan(0.5); // đề nhất quán phải ra α dương, không phải -1
  });

  it("đề nhất quán nhiều câu không còn ra -1 (lỗi cũ: α luôn âm)", () => {
    // Học sinh khá hơn làm đúng nhiều câu hơn, 20 câu × 30 bài.
    const matrix = Array.from({ length: 30 }, (_, i) =>
      Array.from({ length: 20 }, (_, q) => (q < (i * 20) / 30 ? 1 : 0)),
    );
    expect(reliabilityFromMatrix(matrix)!.alpha).toBeGreaterThan(0.9);
  });

  it("điểm TB và SD theo thang %", () => {
    const r = reliabilityFromMatrix(consistent)!;
    expect(r.n).toBe(6);
    expect(r.mean).toBe(Math.round(((13 / 24) * 100) * 10) / 10);
    expect(r.sd).toBeGreaterThan(0);
  });

  it("mọi bài cùng điểm → α = -1 (không tính được)", () => {
    const same = Array.from({ length: 6 }, () => [1, 0, 1]);
    expect(reliabilityFromMatrix(same)!.alpha).toBe(-1);
  });

  it("ít hơn 5 bài hoặc dưới 2 câu → null", () => {
    expect(reliabilityFromMatrix(consistent.slice(0, RELIABILITY_MIN_ATTEMPTS - 1))).toBeNull();
    expect(reliabilityFromMatrix(Array.from({ length: 6 }, () => [1]))).toBeNull();
    expect(reliabilityFromMatrix([])).toBeNull();
  });
});
