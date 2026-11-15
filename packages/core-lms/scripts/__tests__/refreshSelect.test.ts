import { describe, expect, it } from "vitest";
import { lessonKey, selectLessons, stableStringify, type LessonRef } from "../refresh-select";

const refs = (specs: Array<[string, string, unknown]>): LessonRef[] => specs.map(([moduleTitle, lessonTitle, spec]) => ({ moduleTitle, lessonTitle, spec }));

describe("chọn bài cần làm mới", () => {
  const cur = refs([
    ["Lesson 1", "Text 1", { body: "a", n: 1 }],
    ["Lesson 1", "Text 2", { body: "b" }],
    ["Lesson 2", "Text 1", { body: "c" }],
  ]);

  it("không điều kiện thì chọn hết", () => {
    expect(selectLessons(cur, {})).toHaveLength(3);
  });

  it("--since: chỉ bài khác bản cũ hoặc chưa có trong bản cũ", () => {
    const old = new Map([
      [lessonKey("Lesson 1", "Text 1"), stableStringify({ body: "a", n: 1 })],
      [lessonKey("Lesson 1", "Text 2"), stableStringify({ body: "KHÁC" })],
    ]);
    const got = selectLessons(cur, { since: old }).map((r) => lessonKey(r.moduleTitle, r.lessonTitle));
    expect(got).toEqual(["Lesson 1 / Text 2", "Lesson 2 / Text 1"]);
  });

  it("so sánh không phụ thuộc thứ tự khoá và bỏ khoá undefined", () => {
    expect(stableStringify({ b: 1, a: [{ y: 2, x: undefined, z: 1 }] })).toBe(stableStringify({ a: [{ z: 1, y: 2 }], b: 1 }));
  });

  it("--only: lọc theo chuỗi trong khoá, không phân biệt hoa thường, nhiều chuỗi ngăn bằng |", () => {
    expect(selectLessons(cur, { only: ["lesson 2"] })).toHaveLength(1);
    expect(selectLessons(cur, { only: ["Lesson 1 / Text 2", "lesson 2"] })).toHaveLength(2);
    expect(selectLessons(cur, { only: ["không có"] })).toHaveLength(0);
  });

  it("--only và --since cùng có thì phải thoả cả hai", () => {
    const old = new Map([[lessonKey("Lesson 2", "Text 1"), stableStringify({ body: "c" })]]);
    expect(selectLessons(cur, { only: ["lesson 2"], since: old })).toHaveLength(0);
    expect(selectLessons(cur, { only: ["lesson 1"], since: old })).toHaveLength(2);
  });
});
