import { describe, expect, it } from "vitest";
import { cleanQuery, foldVi, matchScore, splitHighlight, SEARCH_QUERY_MAX } from "./instructorSearchShared";

describe("foldVi", () => {
  it("bỏ dấu tiếng Việt và đưa về chữ thường", () => {
    expect(foldVi("Thiết kế UI/UX")).toBe("thiet ke ui/ux");
    expect(foldVi("Đề thi giữa kỳ")).toBe("de thi giua ky");
  });
  it("giữ nguyên độ dài để vị trí khớp dùng được trên chuỗi gốc", () => {
    for (const s of ["Các công nghệ giáo dục tiên tiến", "Tiếng Trung III", "Đấu trường"]) {
      expect(foldVi(s).length).toBe(s.normalize("NFC").length);
    }
  });
  it("coi dấu rời (NFD) như dấu dựng sẵn", () => {
    expect(foldVi("Thiết".normalize("NFD"))).toBe("thiet");
  });
});

describe("cleanQuery", () => {
  it("gọn khoảng trắng, cắt độ dài, bỏ giá trị không phải chuỗi", () => {
    expect(cleanQuery("  thiết   kế ")).toBe("thiết kế");
    expect(cleanQuery("a".repeat(500))).toHaveLength(SEARCH_QUERY_MAX);
    expect(cleanQuery(undefined)).toBe("");
    expect(cleanQuery(42)).toBe("");
  });
});

describe("matchScore", () => {
  const q = foldVi("thiet ke");
  it("không khớp thì 0", () => {
    expect(matchScore("Tiếng Trung III", q)).toBe(0);
  });
  it("xếp mở đầu tiêu đề > đầu từ > giữa từ", () => {
    expect(matchScore("Thiết kế UI/UX", q)).toBe(3);
    expect(matchScore("Bài 2 · Thiết kế giao diện", q)).toBe(2);
    expect(matchScore("Ethiet kế", q)).toBe(1);
  });
  it("từ khoá rỗng không khớp gì", () => {
    expect(matchScore("Thiết kế", "")).toBe(0);
  });
});

describe("splitHighlight", () => {
  it("tô đậm đúng đoạn khớp dù gõ không dấu", () => {
    expect(splitHighlight("Bài 2.3 · Thiết kế giao diện", "thiet ke")).toEqual([
      { text: "Bài 2.3 · ", hit: false },
      { text: "Thiết kế", hit: true },
      { text: " giao diện", hit: false },
    ]);
  });
  it("không khớp thì trả nguyên tiêu đề", () => {
    expect(splitHighlight("Tiếng Trung III", "slide")).toEqual([{ text: "Tiếng Trung III", hit: false }]);
  });
});
