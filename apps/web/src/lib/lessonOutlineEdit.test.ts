import { describe, expect, it } from "vitest";
import type { LessonOutline, OutlineSection } from "@feedbackme/shared-types";
import {
  addSection,
  assignPara,
  ignoreParas,
  mergeLessonUp,
  moveSection,
  paraRangeLabel,
  removeSection,
  splitLessonAt,
} from "./lessonOutlineEdit";

const sec = (id: string, paras: number[] = []): OutlineSection => ({ id, title: id.toUpperCase(), layout: "text", points: [], boxes: [], paras });

const O: LessonOutline = {
  ignoredParas: [9],
  lessons: [
    { id: "l1", title: "Bài 1", objectives: ["Mục tiêu A."], sections: [sec("a", [0, 1]), sec("b", [2]), sec("c", [3])] },
    { id: "l2", title: "Bài 2", objectives: ["Mục tiêu B."], sections: [sec("d", [4]), sec("e", [5])] },
  ],
};
const ids = (o: LessonOutline) => o.lessons.map((l) => l.sections.map((s) => s.id).join(""));

describe("sửa dàn ý", () => {
  it("kéo mục trong cùng bài và sang bài khác (D6)", () => {
    expect(ids(moveSection(O, "c", "a"))).toEqual(["cab", "de"]);
    expect(ids(moveSection(O, "a", "e"))).toEqual(["bc", "dae"]);
    expect(ids(moveSection(O, "d", "b"))).toEqual(["abdc", "e"]);
    expect(moveSection(O, "a", "a")).toBe(O);
  });

  it("kéo hết mục ra khỏi một bài thì bài đó biến mất", () => {
    const one = moveSection(moveSection(O, "d", "c"), "e", "c");
    expect(ids(one)).toEqual(["abced"]);
  });

  it("tách bài từ một mục và gộp lại (D5)", () => {
    const split = splitLessonAt(O, 0, 1);
    expect(ids(split)).toEqual(["a", "bc", "de"]);
    expect(split.lessons[1]!.title).toBe("B");
    const merged = mergeLessonUp(split, 1);
    expect(ids(merged)).toEqual(["abc", "de"]);
    expect(mergeLessonUp(O, 1).lessons[0]!.objectives).toEqual(["Mục tiêu A.", "Mục tiêu B."]);
    expect(splitLessonAt(O, 0, 0)).toBe(O);
  });

  it("thêm và xoá mục; xoá mục thì đoạn của nó thành đoạn lạc", () => {
    const { outline, id } = addSection(O, 1, "steps");
    expect(outline.lessons[1]!.sections.at(-1)).toMatchObject({ id, layout: "steps", title: "Mục mới" });
    const removed = removeSection(O, "b");
    expect(ids(removed)).toEqual(["ac", "de"]);
    expect(removed.lessons.flatMap((l) => l.sections.flatMap((s) => s.paras))).not.toContain(2);
  });

  it("gán đoạn chuyển nó khỏi mục cũ và khỏi danh sách bỏ qua; bỏ qua thì gỡ khỏi mục", () => {
    const a = assignPara(O, 9, "b");
    expect(a.ignoredParas).toEqual([]);
    expect(a.lessons[0]!.sections[1]!.paras).toEqual([2, 9]);
    const moved = assignPara(O, 0, "e");
    expect(moved.lessons[0]!.sections[0]!.paras).toEqual([1]);
    expect(moved.lessons[1]!.sections[1]!.paras).toEqual([0, 5]);
    const ig = ignoreParas(O, [1, 4]);
    expect(ig.ignoredParas).toEqual([1, 4, 9]);
    expect(ig.lessons[0]!.sections[0]!.paras).toEqual([0]);
    expect(ig.lessons[1]!.sections[0]!.paras).toEqual([]);
  });

  it("nhãn đoạn gọn: dải liên tiếp và đoạn rời, đánh số từ 1", () => {
    expect(paraRangeLabel([2, 3, 4, 5, 6, 8])).toBe("Đoạn 3–7, 9");
    expect(paraRangeLabel([0])).toBe("Đoạn 1");
    expect(paraRangeLabel([])).toBe("Chưa có đoạn");
  });
});
