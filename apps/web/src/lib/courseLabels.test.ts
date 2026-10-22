import { describe, expect, it } from "vitest";
import { courseMetaLine, modulePrefix } from "./courseLabels";

describe("courseMetaLine", () => {
  it("dịch mã trình độ, ẩn ngôn ngữ khi là tiếng Việt", () => {
    expect(courseMetaLine("beginner", "vi")).toBe("Cơ bản");
  });

  it("ghi ngôn ngữ khi khoá không dạy bằng tiếng Việt", () => {
    expect(courseMetaLine("intermediate", "zh")).toBe("Trung cấp · Tiếng Trung");
  });

  it("mã lạ giữ nguyên thay vì để trống", () => {
    expect(courseMetaLine("expert", "fr")).toBe("expert · fr");
  });
});

describe("modulePrefix", () => {
  it("bỏ tiền tố khi tên đã tự đánh số", () => {
    for (const t of [
      "Module 1 — Khái niệm cơ bản",
      "Module 3 · Tư duy phản biện",
      "Chương 3 · Bài tập",
      "Bài 5 — Làm quen",
      "M1",
      "1. Mở đầu",
      "  module 2",
    ]) {
      expect(modulePrefix(t, 0)).toBeNull();
    }
  });

  it("đánh số theo thứ tự khi tên chưa có số", () => {
    expect(modulePrefix("Nghiên cứu & phác thảo", 2)).toBe("Module 3");
  });
});
