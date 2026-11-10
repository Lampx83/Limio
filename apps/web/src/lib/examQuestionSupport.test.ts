import { describe, expect, it } from "vitest";
import { QUESTION_TYPES } from "@/components/question-editor/types";
import { PLAYABLE_EXAM_QUESTION_TYPES, isPlayableExamQuestionType } from "./examQuestionSupport";

describe("examQuestionSupport", () => {
  it("đủ 10 loại của trình soạn làm được; loại lạ thì không", () => {
    for (const t of QUESTION_TYPES) expect(isPlayableExamQuestionType(t), t).toBe(true);
    expect(PLAYABLE_EXAM_QUESTION_TYPES).toHaveLength(QUESTION_TYPES.length);
    for (const t of ["matching_heading", "lạ", ""]) expect(isPlayableExamQuestionType(t), t).toBe(false);
  });

  it("mọi loại làm được đều là loại trình soạn biết (không có tên gõ nhầm)", () => {
    for (const t of PLAYABLE_EXAM_QUESTION_TYPES) expect((QUESTION_TYPES as readonly string[]).includes(t), t).toBe(true);
  });
});
