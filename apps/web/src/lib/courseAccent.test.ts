import { describe, expect, it } from "vitest";
import { accentVar } from "./courseAccent";

describe("accentVar", () => {
  it("nhận r,g,b hợp lệ và trả dạng biến CSS", () => {
    expect(accentVar("229,0,92")).toBe("229 0 92");
    expect(accentVar(" 0,0,0 ")).toBe("0 0 0");
  });
  it("từ chối giá trị lạ, vượt 255 hoặc trống", () => {
    for (const v of [null, undefined, "", "#E5005C", "javascript:alert(1)", "256,0,0", "1,2", "1,2,3,4"]) expect(accentVar(v)).toBeNull();
  });
});
