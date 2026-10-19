import { describe, expect, it } from "vitest";
import { cleanConversationId, cleanCount, cleanEventBase, cleanLinkClick, cleanPage, cleanSource } from "./assistantLog";

describe("cleanPage", () => {
  it("giữ đường dẫn nội bộ và bỏ query/hash", () => {
    expect(cleanPage("/instructor/courses?tab=2#x")).toBe("/instructor/courses");
  });
  it("bỏ đường dẫn đổi origin, chuỗi lạ và không phải chuỗi", () => {
    expect(cleanPage("//evil.com/x")).toBeNull();
    expect(cleanPage("https://evil.com")).toBeNull();
    expect(cleanPage("/a b")).toBeNull();
    expect(cleanPage(42)).toBeNull();
    expect(cleanPage(undefined)).toBeNull();
  });
});

describe("cleanConversationId", () => {
  it("nhận uuid, từ chối chuỗi lạ", () => {
    expect(cleanConversationId("3f2c1a9e-8b7d-4c6e-9a10-1b2c3d4e5f60")).toBe("3f2c1a9e-8b7d-4c6e-9a10-1b2c3d4e5f60");
    expect(cleanConversationId("<script>alert(1)</script>")).toBeNull();
    expect(cleanConversationId("a")).toBeNull();
    expect(cleanConversationId("x".repeat(65))).toBeNull();
  });
});

describe("cleanSource", () => {
  it("nguồn lạ về typed", () => {
    expect(cleanSource("suggestion")).toBe("suggestion");
    expect(cleanSource("followup")).toBe("followup");
    expect(cleanSource("hack")).toBe("typed");
    expect(cleanSource(undefined)).toBe("typed");
  });
});

describe("cleanEventBase", () => {
  it("chịu được body không phải object", () => {
    expect(cleanEventBase(null)).toEqual({ conversationId: null, page: null });
    expect(cleanEventBase("x")).toEqual({ conversationId: null, page: null });
  });
});

describe("cleanLinkClick", () => {
  it("cần cả mã điểm đến lẫn đường dẫn nội bộ", () => {
    expect(cleanLinkClick({ destinationId: "exams", href: "/instructor/exams?x=1" })).toEqual({ destinationId: "exams", href: "/instructor/exams" });
    expect(cleanLinkClick({ destinationId: "", href: "/a" })).toBeNull();
    expect(cleanLinkClick({ destinationId: "exams", href: "https://x.com" })).toBeNull();
    expect(cleanLinkClick(null)).toBeNull();
  });
});

describe("cleanCount", () => {
  it("ép về số nguyên trong khoảng", () => {
    expect(cleanCount(7.9)).toBe(7);
    expect(cleanCount(-3)).toBe(0);
    expect(cleanCount(10_000)).toBe(100);
    expect(cleanCount("5")).toBe(0);
    expect(cleanCount(NaN)).toBe(0);
  });
});
