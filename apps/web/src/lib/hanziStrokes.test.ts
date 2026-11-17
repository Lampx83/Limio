import { describe, expect, it } from "vitest";
import { hanChars, hanziDataPath } from "./hanziStrokes";

describe("hanziStrokes", () => {
  it("lấy từng chữ Hán theo thứ tự, bỏ dấu câu và chữ Latinh", () => {
    expect(hanChars("菜单")).toEqual(["菜", "单"]);
    expect(hanChars("(一)点儿 ABC")).toEqual(["一", "点", "儿"]);
    expect(hanChars("thực đơn")).toEqual([]);
  });
  it("đường dẫn mã hoá chữ Hán", () => {
    expect(hanziDataPath("好")).toBe("/hanzi/%E5%A5%BD.json");
  });
});
