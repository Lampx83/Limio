import { describe, expect, it } from "vitest";
import { splitUnitTitle } from "./HskHero";

describe("splitUnitTitle", () => {
  it("tách số bài, tên Hán, tên Việt", () => {
    expect(splitUnitTitle("Bài 1 · 搬进新家 — Dọn về nhà mới")).toEqual({ no: "Bài 1", han: "搬进新家", vi: "Dọn về nhà mới" });
  });
  it("thiếu một phần hoặc không khớp", () => {
    expect(splitUnitTitle("Bài 25 · Ôn tập tổng kết")).toEqual({ no: "Bài 25", han: "", vi: "Ôn tập tổng kết" });
    expect(splitUnitTitle("Bài 1 · 我们去机场接你们")).toEqual({ no: "Bài 1", han: "我们去机场接你们", vi: "" });
    expect(splitUnitTitle("Unit 3")).toBeNull();
  });
});
