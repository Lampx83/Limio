import { describe, expect, it } from "vitest";
import { parseScanTarget } from "./scanTarget";

describe("parseScanTarget", () => {
  it("nhận link thi viết, kể cả khi sau tiền tố đường dẫn production", () => {
    expect(parseScanTarget("https://limio.vn/exam/ab12cd")).toEqual({
      kind: "exam",
      code: "AB12CD",
      path: "/exam/AB12CD",
    });
    expect(parseScanTarget("https://x.vn/app/exam/ABCD2345?src=qr")?.path).toBe("/exam/ABCD2345");
  });

  it("nhận link vấn đáp", () => {
    expect(parseScanTarget("https://limio.vn/oral/a3k7m2")).toEqual({
      kind: "oral",
      code: "A3K7M2",
      path: "/oral/A3K7M2",
    });
  });

  it("mã trần coi như mã thi (hành vi cũ)", () => {
    expect(parseScanTarget(" abc123 ")?.kind).toBe("exam");
  });

  it("từ chối QR không liên quan", () => {
    expect(parseScanTarget("https://example.com/hello")).toBeNull();
    expect(parseScanTarget("https://limio.vn/oral/ABC")).toBeNull();
    expect(parseScanTarget("")).toBeNull();
  });
});
