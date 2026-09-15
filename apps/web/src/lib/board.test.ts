import { describe, expect, it } from "vitest";
import { normalizeBoardColumns, BOARD_MAX_COLUMNS, BOARD_COLUMN_LABEL_MAX_LEN } from "./board";

describe("normalizeBoardColumns", () => {
  it("board mặc định không grid → mảng rỗng hợp lệ", () => {
    expect(normalizeBoardColumns([])).toEqual([]);
  });

  it("trim khoảng trắng và bỏ nhãn rỗng", () => {
    expect(normalizeBoardColumns(["  Nhóm 1  ", "", "   ", "Nhóm 2"])).toEqual([
      "Nhóm 1",
      "Nhóm 2",
    ]);
  });

  it("khử trùng lặp, giữ nguyên thứ tự xuất hiện đầu tiên", () => {
    expect(normalizeBoardColumns(["Nhóm 1", "Nhóm 2", "Nhóm 1"])).toEqual(["Nhóm 1", "Nhóm 2"]);
  });

  it("quá số cột tối đa → null (route trả 400)", () => {
    const tooMany = Array.from({ length: BOARD_MAX_COLUMNS + 1 }, (_, i) => `Nhóm ${i}`);
    expect(normalizeBoardColumns(tooMany)).toBeNull();
  });

  it("nhãn quá dài → null", () => {
    const tooLong = "x".repeat(BOARD_COLUMN_LABEL_MAX_LEN + 1);
    expect(normalizeBoardColumns([tooLong])).toBeNull();
  });

  it("input không phải mảng → null", () => {
    expect(normalizeBoardColumns("Nhóm 1")).toBeNull();
    expect(normalizeBoardColumns(undefined)).toBeNull();
  });

  it("phần tử không phải string → null", () => {
    expect(normalizeBoardColumns(["Nhóm 1", 2])).toBeNull();
  });
});
