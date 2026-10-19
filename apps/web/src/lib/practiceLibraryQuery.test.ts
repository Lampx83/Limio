import { describe, expect, it } from "vitest";
import { levelLabelText, libraryQueryString, parseLibraryParams, statusLabelText } from "@/lib/practiceLibraryQuery";

/** LANG L6.2 — bộ lọc thư viện đề ⇄ tham số URL (thuần). */

describe("parseLibraryParams", () => {
  it("đọc đủ các bộ lọc hợp lệ từ searchParams", () => {
    const f = parseLibraryParams({ c: "abc", t: "official", y: "2023", d: "3", s: "redo", q: " tuần 1 ", sort: "unstarted", cursor: "30" });
    expect(f).toEqual({ collectionId: "abc", paperType: "official", year: "2023", difficulty: 3, status: "redo", q: "tuần 1", sort: "unstarted", cursor: "30" });
  });
  it("giá trị lạ/rác bị bỏ, không ném lỗi", () => {
    expect(parseLibraryParams({ t: "zzz", d: "9", s: "nope", sort: "random", cursor: "-5", y: "", q: "   " })).toEqual({});
    expect(parseLibraryParams({})).toEqual({});
  });
  it("nhận giá trị mảng (lấy phần tử đầu) và 'none' cho đề chưa thuộc bộ", () => {
    expect(parseLibraryParams({ c: ["none", "x"] })).toEqual({ collectionId: "none" });
  });
  it("độ dài q bị giới hạn (chống chuỗi khổng lồ)", () => {
    expect(parseLibraryParams({ q: "x".repeat(500) }).q).toHaveLength(100);
  });
});

describe("libraryQueryString", () => {
  it("dựng chuỗi truy vấn ổn định, bỏ trường rỗng, mã hoá ký tự đặc biệt", () => {
    expect(libraryQueryString({})).toBe("");
    expect(libraryQueryString({ collectionId: "a", q: "tuần 1 & 2", difficulty: 2 })).toBe("c=a&d=2&q=tu%E1%BA%A7n+1+%26+2");
  });
  it("khứ hồi: parse(query(x)) = x", () => {
    const f = { collectionId: "none", paperType: "mock" as const, year: "2024", difficulty: 4, status: "not_started" as const, q: "hsk", sort: "newest" as const };
    const sp = Object.fromEntries(new URLSearchParams(libraryQueryString(f)));
    expect(parseLibraryParams(sp)).toEqual(f);
  });
});

describe("nhãn tiếng Việt", () => {
  it("trạng thái của tôi", () => {
    expect(statusLabelText("not_started")).toBe("Chưa làm");
    expect(statusLabelText("in_progress")).toBe("Đang làm");
    expect(statusLabelText("done")).toBe("Đã làm");
    expect(statusLabelText("redo")).toBe("Nên làm lại");
  });
  it("mức gần nhất là nhãn, không phải số; null → rỗng", () => {
    expect(levelLabelText("needs_review")).toBe("Cần ôn");
    expect(levelLabelText("practice_more")).toBe("Nên luyện");
    expect(levelLabelText("solid")).toBe("Vững");
    expect(levelLabelText(null)).toBe("");
    expect(levelLabelText("no_data")).toBe("");
  });
});
