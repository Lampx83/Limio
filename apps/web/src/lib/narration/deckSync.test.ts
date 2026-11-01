import { describe, expect, it } from "vitest";
import { deckAnchor, firstSegmentOfDeckSlide, isDeckLecture, parseDeckAnchor, parseDeckMessage, segmentForDeckPos } from "./deckSync";

const A = ["s0b0", "s0b1", "s1b0", "s2b0", "s2b2"];

describe("anchor của bài deck", () => {
  it("đọc và ghi qua lại", () => {
    expect(parseDeckAnchor(deckAnchor(12, 3))).toEqual({ slide: 12, step: 3 });
  });
  it("không nhận anchor kiểu tiêu đề mục", () => {
    expect(parseDeckAnchor("Đỉnh và trục")).toBeNull();
    expect(parseDeckAnchor("s1")).toBeNull();
    expect(parseDeckAnchor("s1b")).toBeNull();
  });
  it("isDeckLecture: chỉ khi mọi anchor là dạng deck", () => {
    expect(isDeckLecture(A)).toBe(true);
    expect(isDeckLecture([...A, "mo-dau"])).toBe(false);
    expect(isDeckLecture([])).toBe(false);
  });
});

describe("tìm đoạn giảng theo vị trí khung", () => {
  it("đúng slide và bước", () => {
    expect(segmentForDeckPos(A, 0, 1)).toBe(1);
    expect(segmentForDeckPos(A, 1, 0)).toBe(2);
  });
  it("bước không có lời thì lấy bước gần nhất trước nó trong cùng slide", () => {
    expect(segmentForDeckPos(A, 2, 1)).toBe(3);
    expect(segmentForDeckPos(A, 2, 5)).toBe(4);
  });
  it("slide không có lời giảng: -1", () => {
    expect(segmentForDeckPos(A, 7, 0)).toBe(-1);
  });
  it("firstSegmentOfDeckSlide: đoạn đầu của slide, kể cả khi không có bước 0", () => {
    expect(firstSegmentOfDeckSlide(A, 2)).toBe(3);
    expect(firstSegmentOfDeckSlide(["s4b1", "s4b2"], 4)).toBe(0);
    expect(firstSegmentOfDeckSlide(A, 9)).toBe(-1);
  });
});

describe("tin từ khung", () => {
  it("nhận tin đúng giao thức", () => {
    expect(parseDeckMessage({ smartdocSlide: true, loai: "trang", i: 3, n: 20 })).toEqual({ loai: "trang", i: 3, n: 20, b: undefined, nb: undefined });
  });
  it("bỏ tin lạ", () => {
    expect(parseDeckMessage(null)).toBeNull();
    expect(parseDeckMessage("x")).toBeNull();
    expect(parseDeckMessage({ loai: "trang" })).toBeNull();
    expect(parseDeckMessage({ smartdocSlide: true, loai: 5 })).toBeNull();
  });
  it("số không hữu hạn bị bỏ", () => {
    expect(parseDeckMessage({ smartdocSlide: true, loai: "trang", i: NaN })!.i).toBeUndefined();
  });
});
