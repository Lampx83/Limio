import { describe, expect, it } from "vitest";
import { insertGapLabel, moveIdTo } from "./limioLiveInsert";

describe("chèn slide vào giữa bài", () => {
  it("đưa slide mới về đúng vị trí; vị trí ngoài khoảng thì để cuối", () => {
    expect(moveIdTo(["a", "b", "c", "n"], "n", 1)).toEqual(["a", "n", "b", "c"]);
    expect(moveIdTo(["a", "b", "c", "n"], "n", 0)).toEqual(["n", "a", "b", "c"]);
    expect(moveIdTo(["a", "b", "c", "n"], "n", 3)).toEqual(["a", "b", "c", "n"]);
    expect(moveIdTo(["a", "b", "c", "n"], "n", 99)).toEqual(["a", "b", "c", "n"]);
    expect(moveIdTo(["a", "b", "c", "n"], "n", -1)).toEqual(["a", "b", "c", "n"]);
  });
  it("lời nhắc theo vị trí", () => {
    expect(insertGapLabel(0, 5)).toBe("Chèn slide mới vào trước slide 1");
    expect(insertGapLabel(5, 5)).toBe("Thêm slide vào cuối bài");
  });
});
