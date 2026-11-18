import { describe, expect, it } from "vitest";
import { clearSlot, clearToken, orderFromSlots, placeInSlot, placeToken, poolOf, removeFromSlots, shiftSlot, slotsFromOrder } from "./practiceDnd";

const ids = ["a", "b", "c", "d"];

describe("ô thứ tự (câu Sắp xếp)", () => {
  it("dựng từ đáp án đã lưu, bỏ mảnh lạ và mảnh trùng", () => {
    expect(slotsFromOrder(["b", "a", "c", "d"], ids)).toEqual(["b", "a", "c", "d"]);
    expect(slotsFromOrder(["b", "x", "b", "a"], ids)).toEqual(["b", "a", null, null]);
    expect(slotsFromOrder(null, ids)).toEqual([null, null, null, null]);
  });
  it("chỉ cho ra thứ tự để lưu khi đủ ô và không trùng", () => {
    expect(orderFromSlots(["b", "a", "c", "d"])).toEqual(["b", "a", "c", "d"]);
    expect(orderFromSlots(["b", null, "c", "d"])).toBeNull();
    expect(orderFromSlots(["b", "b", "c", "d"])).toBeNull();
    expect(orderFromSlots([])).toBeNull();
  });
  it("đặt mảnh vào ô trống; mảnh ở khay đặt vào ô có mảnh thì mảnh cũ về khay", () => {
    let s = slotsFromOrder([], ids);
    s = placeInSlot(s, "c", 0);
    expect(s).toEqual(["c", null, null, null]);
    s = placeInSlot(s, "a", 0);
    expect(s).toEqual(["a", null, null, null]);
    expect(poolOf(ids, s)).toEqual(["b", "c", "d"]);
  });
  it("kéo từ ô sang ô: ô trống thì dời, ô có mảnh thì đổi chỗ", () => {
    expect(placeInSlot(["a", "b", null, null], "a", 3)).toEqual([null, "b", null, "a"]);
    expect(placeInSlot(["a", "b", null, null], "a", 1)).toEqual(["b", "a", null, null]);
    expect(placeInSlot(["a", "b", null, null], "a", 0)).toEqual(["a", "b", null, null]);
    expect(placeInSlot(["a", null], "a", 5)).toEqual(["a", null]);
  });
  it("bỏ mảnh về khay", () => {
    expect(removeFromSlots(["a", "b", null, null], "a")).toEqual([null, "b", null, null]);
    expect(clearSlot(["a", "b", null, null], 1)).toEqual(["a", null, null, null]);
  });
  it("mũi tên trái/phải đổi chỗ với ô bên cạnh, không vượt biên", () => {
    expect(shiftSlot(["a", "b", "c", "d"], 1, -1)).toEqual(["b", "a", "c", "d"]);
    expect(shiftSlot(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "b", "c", "d"]);
    expect(shiftSlot(["a", null, "c", "d"], 0, 1)).toEqual([null, "a", "c", "d"]);
    expect(shiftSlot([null, "b"], 0, 1)).toEqual([null, "b"]);
  });
});

describe("kéo thả điền", () => {
  it("mỗi từ một chỗ: đặt từ đang ở chỗ khác thì chuyển; chỗ đích có từ thì thay", () => {
    expect(placeToken({}, "1", "T1")).toEqual({ "1": "T1" });
    expect(placeToken({ "1": "T1" }, "2", "T1")).toEqual({ "2": "T1" });
    expect(placeToken({ "1": "T1", "2": "T2" }, "1", "T2")).toEqual({ "1": "T2" });
  });
  it("bỏ từ khỏi chỗ trống", () => {
    expect(clearToken({ "1": "T1", "2": "T2" }, "1")).toEqual({ "2": "T2" });
  });
});
