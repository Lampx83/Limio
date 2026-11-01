import { describe, expect, it } from "vitest";
import { lecturerVideoEnabled } from "./lecturerVideoFlag";

describe("cờ video giảng viên", () => {
  it("mặc định bật", () => {
    expect(lecturerVideoEnabled({})).toBe(true);
    expect(lecturerVideoEnabled({ NARRATION_LECTURER_VIDEO: "" })).toBe(true);
    expect(lecturerVideoEnabled({ NARRATION_LECTURER_VIDEO: "1" })).toBe(true);
  });
  it("tắt bằng 0 / off / false / no, không phân biệt hoa thường", () => {
    for (const v of ["0", "off", "OFF", " false ", "No"]) expect(lecturerVideoEnabled({ NARRATION_LECTURER_VIDEO: v })).toBe(false);
  });
});
