import { describe, expect, it } from "vitest";
import { classifyStorageKey, uploaderFromStorageKey } from "../index";
import { SWEEPABLE_KINDS } from "../orphans";

/**
 * File đính kèm bài học (lesson-media/files/) phải đi đúng qua sổ dung lượng.
 * Rơi vào "other" thì không tính quota đúng chủ khoá và không bao giờ được dọn.
 */

const uid = "11111111-2222-4333-8444-555555555555";

describe("classifyStorageKey — file đính kèm bài học", () => {
  it("lesson-media/files/ → lesson_file, không rơi vào other", () => {
    expect(classifyStorageKey("public", "lesson-media/files/2026/10/x.docx")).toBe("lesson_file");
  });

  it("suy được người upload từ tên file", () => {
    expect(uploaderFromStorageKey(`lesson-media/files/2026/10/${uid}-1790000000000-ab12cd34ef567890.zip`)).toBe(uid);
  });

  it("lesson_file nằm trong danh sách loại được phép dọn", () => {
    expect(SWEEPABLE_KINDS).toContain("lesson_file");
  });
});
