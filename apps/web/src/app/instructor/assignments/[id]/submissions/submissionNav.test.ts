import { describe, expect, it } from "vitest";
import { neighborSubmissions } from "./submissionNav";

// Acceptance criteria — chuyển bài trong màn hình chấm:
//  Given danh sách đã lọc + sắp xếp như GV đang thấy trên bảng
//  When  GV bấm Trước/Sau
//  Then  đi theo đúng thứ tự đó, bỏ qua dòng chưa nộp bài
//  Given bật "Chỉ bài chờ chấm"
//  Then  bỏ qua bài đã chấm, nhưng bài đang mở luôn nằm trong danh sách
//        (để chấm xong vẫn thấy mình đang ở đâu, không bị biến mất)
type Row = { submission: { id: string; status: "submitted" | "graded" } | null };
const sub = (id: string, status: "submitted" | "graded"): Row => ({ submission: { id, status } });
const none: Row = { submission: null };

const rows: Row[] = [sub("A", "graded"), none, sub("C", "submitted"), sub("D", "submitted"), sub("E", "graded")];

describe("neighborSubmissions", () => {
  it("bỏ qua dòng chưa nộp, đi theo thứ tự bảng", () => {
    expect(neighborSubmissions(rows, "C", false)).toEqual({
      prevId: "A", nextId: "D", position: 2, total: 4,
    });
  });

  it("bài đầu không có Trước, bài cuối không có Sau", () => {
    expect(neighborSubmissions(rows, "A", false)).toMatchObject({ prevId: null, nextId: "C", position: 1 });
    expect(neighborSubmissions(rows, "E", false)).toMatchObject({ prevId: "D", nextId: null, position: 4 });
  });

  it("chỉ bài chờ chấm: bỏ bài đã chấm", () => {
    expect(neighborSubmissions(rows, "C", true)).toEqual({
      prevId: null, nextId: "D", position: 1, total: 2,
    });
    expect(neighborSubmissions(rows, "D", true)).toEqual({
      prevId: "C", nextId: null, position: 2, total: 2,
    });
  });

  it("chỉ bài chờ chấm: bài đang mở dù đã chấm vẫn nằm trong danh sách", () => {
    expect(neighborSubmissions(rows, "A", true)).toEqual({
      prevId: null, nextId: "C", position: 1, total: 3,
    });
    expect(neighborSubmissions(rows, "E", true)).toEqual({
      prevId: "D", nextId: null, position: 3, total: 3,
    });
  });

  it("id không có trong danh sách → không có hàng xóm", () => {
    expect(neighborSubmissions(rows, "ZZZ", false)).toEqual({
      prevId: null, nextId: null, position: 0, total: 4,
    });
    expect(neighborSubmissions([], "A", false)).toEqual({
      prevId: null, nextId: null, position: 0, total: 0,
    });
  });
});
