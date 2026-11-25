import { describe, expect, it } from "vitest";
import { lessonNeighbours } from "./lessonNeighbours";

const mods = [
  { id: "m0", title: "Chủ đề 0", lessons: [{ id: "a", title: "Bài 0.1" }, { id: "b", title: "Bài 0.2" }] },
  { id: "m1", title: "Chủ đề 1", lessons: [{ id: "c", title: "Mở đầu", locked: true }] },
];

describe("lessonNeighbours", () => {
  it("bài đầu: không có bài trước, bài sau cùng chương", () => {
    const r = lessonNeighbours(mods, "a");
    expect(r.prev).toBeNull();
    expect(r.next).toMatchObject({ id: "b", newModule: false, locked: false });
    expect(r.position).toBe(1);
    expect(r.total).toBe(3);
  });
  it("sang chương mới thì báo newModule và mang theo cờ khoá", () => {
    const r = lessonNeighbours(mods, "b");
    expect(r.prev).toMatchObject({ id: "a" });
    expect(r.next).toMatchObject({ id: "c", moduleTitle: "Chủ đề 1", newModule: true, locked: true });
  });
  it("bài cuối: hết khoá", () => {
    const r = lessonNeighbours(mods, "c");
    expect(r.next).toBeNull();
    expect(r.prev).toMatchObject({ id: "b", newModule: true });
  });
  it("bài không có trong danh sách (bị ẩn): không trả gì", () => {
    expect(lessonNeighbours(mods, "zzz")).toEqual({ prev: null, next: null, position: 0, total: 3 });
  });
});
