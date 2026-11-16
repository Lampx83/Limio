import { describe, expect, it } from "vitest";
import { distributeLessons } from "./sessionDistribution";

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe("distributeLessons — chia bài theo số buổi (CENTER K2)", () => {
  it("48 bài, 24 buổi: mỗi buổi 2 bài, giữ đúng thứ tự", () => {
    const out = distributeLessons(range(48), 24);
    expect(out).toHaveLength(24);
    expect(out.every((s) => s.length === 2)).toBe(true);
    expect(out.flat()).toEqual(range(48));
    expect(out[0]).toEqual([1, 2]);
  });

  it("50 bài, 24 buổi: hai buổi đầu 3 bài, còn lại 2 bài", () => {
    const out = distributeLessons(range(50), 24);
    expect(out.map((s) => s.length)).toEqual([3, 3, ...Array(22).fill(2)]);
    expect(out.flat()).toEqual(range(50));
  });

  it("số buổi lớn hơn số bài: các buổi cuối trống", () => {
    expect(distributeLessons(range(3), 5)).toEqual([[1], [2], [3], [], []]);
  });

  it("số buổi không hợp lệ thì không chia", () => {
    expect(distributeLessons(range(3), 0)).toEqual([]);
    expect(distributeLessons(range(3), Number.NaN)).toEqual([]);
  });
});
