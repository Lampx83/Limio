import { describe, expect, it } from "vitest";
import { isTeachingOnly, switchableRoles } from "./roleWorkspace";

describe("switchableRoles — giảng viên trung tâm vào không gian giảng viên (H10)", () => {
  it("center_teacher không có chế độ riêng: được tính là không gian 'instructor'", () => {
    expect(switchableRoles(["learner", "center_teacher"])).toEqual(["learner", "instructor"]);
  });

  it("đã là giảng viên thường thì không bị lặp", () => {
    expect(switchableRoles(["learner", "instructor", "center_teacher"])).toEqual(["learner", "instructor"]);
  });

  it("vai năng lực cộng thêm (researcher) vẫn bị bỏ; vai khác giữ nguyên thứ tự", () => {
    expect(switchableRoles(["learner", "admin", "researcher"])).toEqual(["learner", "admin"]);
  });

  it("không có center_teacher thì không đổi gì", () => {
    expect(switchableRoles(["learner", "instructor"])).toEqual(["learner", "instructor"]);
    expect(switchableRoles([])).toEqual([]);
  });
});

describe("isTeachingOnly — chỉ dạy, không soạn (H10)", () => {
  it("chỉ có center_teacher (kèm học viên) → chỉ dạy", () => {
    expect(isTeachingOnly(["learner", "center_teacher"])).toBe(true);
    expect(isTeachingOnly(["center_teacher"])).toBe(true);
  });

  it("có thêm giảng viên thường hoặc quản trị → không phải chỉ dạy", () => {
    expect(isTeachingOnly(["learner", "instructor", "center_teacher"])).toBe(false);
    expect(isTeachingOnly(["admin", "center_teacher"])).toBe(false);
  });

  it("không có center_teacher → không phải chỉ dạy", () => {
    expect(isTeachingOnly(["learner", "instructor"])).toBe(false);
    expect(isTeachingOnly([])).toBe(false);
  });
});
