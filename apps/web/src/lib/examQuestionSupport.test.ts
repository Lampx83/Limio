import { describe, expect, it } from "vitest";
import { QUESTION_TYPES } from "@/components/question-editor/types";
import { PLAYABLE_EXAM_QUESTION_TYPES, isPlayableExamQuestionType } from "./examQuestionSupport";

describe("examQuestionSupport", () => {
  it("6 loại làm được; 4 loại còn lại (sắp xếp, ghép cặp, số, kéo thả) chưa", () => {
    for (const t of PLAYABLE_EXAM_QUESTION_TYPES) expect(isPlayableExamQuestionType(t), t).toBe(true);
    for (const t of ["ordering", "matching", "numerical", "drag_drop_fill", "lạ"]) expect(isPlayableExamQuestionType(t), t).toBe(false);
  });

  it("mọi loại làm được đều là loại trình soạn biết (không có tên gõ nhầm)", () => {
    for (const t of PLAYABLE_EXAM_QUESTION_TYPES) expect((QUESTION_TYPES as readonly string[]).includes(t), t).toBe(true);
  });
});
