import { describe, expect, it } from "vitest";
import {
  deckAnchor,
  firstSegmentOfDeckSlide,
  isDeckLecture,
  misplacedPauseMarks,
  parseDeckAnchor,
  parseDeckMessage,
  parseStepPause,
  pauseFromAttr,
  segmentForDeckPos,
  stepPausesOf,
} from "./deckSync";

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

describe("điểm dừng ở cuối bước", () => {
  it("đọc dấu chờ và dấu nghĩ ở cuối bước", () => {
    expect(parseStepPause("Em kéo a nhé. [chờ: Em kéo a sang số âm]")).toEqual({ kieu: "cho", nhac: "Em kéo a sang số âm" });
    expect(parseStepPause("Câu đố. [nghĩ 5: Tháp cao bao nhiêu mét?] ")).toEqual({ kieu: "nghi", giay: 5, nhac: "Tháp cao bao nhiêu mét?" });
  });
  it("dấu giữa bước, thiếu lời nhắc hay thiếu số giây thì không phải điểm dừng", () => {
    expect(parseStepPause("[nghĩ 5: Hỏi?] Đáp ngay.")).toBeNull();
    expect(parseStepPause("Lời. [chờ]")).toBeNull();
    expect(parseStepPause("Lời. [nghĩ: Hỏi?]")).toBeNull();
    expect(parseStepPause("Lời. [dừng 1]")).toBeNull();
  });
  it("chỉ ra dấu đặt sai chỗ", () => {
    expect(misplacedPauseMarks("[nghĩ 5: Hỏi?] Đáp ngay.")).toEqual(["[nghĩ 5: Hỏi?]"]);
    expect(misplacedPauseMarks("Lời. [chờ]")).toEqual(["[chờ]"]);
    expect(misplacedPauseMarks("[chờ: A] Lời. [nghĩ 3: B]")).toEqual(["[chờ: A]"]);
    expect(misplacedPauseMarks("Lời. [nghĩ 3: B]")).toEqual([]);
  });
  it("lập bảng theo bước và đọc lại từ thuộc tính; dữ liệu hỏng thì coi như không có", () => {
    const table = stepPausesOf(["Một.", "Hai. [chờ: Làm đi]", "Ba. [nghĩ 4: Vì sao?]"]);
    expect(Object.keys(table!)).toEqual(["1", "2"]);
    const attr = JSON.stringify(table);
    expect(pauseFromAttr(attr, 1)).toEqual({ kieu: "cho", nhac: "Làm đi" });
    expect(pauseFromAttr(attr, 2)).toEqual({ kieu: "nghi", giay: 4, nhac: "Vì sao?" });
    expect(pauseFromAttr(attr, 0)).toBeNull();
    expect(pauseFromAttr("{hỏng", 1)).toBeNull();
    expect(pauseFromAttr(null, 1)).toBeNull();
    expect(stepPausesOf(["Một.", "Hai."])).toBeNull();
  });
});
