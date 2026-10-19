import { describe, expect, it } from "vitest";
import { examCreateChoices, parseExamCreateType } from "@/lib/examCreateType";

/** LANG L4.1 — bước đầu của "Tạo đề mới": chọn loại đề. */

describe("parseExamCreateType", () => {
  it("nhận language / regular; còn lại → null (hiện bước chọn loại)", () => {
    expect(parseExamCreateType("language")).toBe("language");
    expect(parseExamCreateType("regular")).toBe("regular");
    expect(parseExamCreateType(undefined)).toBeNull();
    expect(parseExamCreateType("")).toBeNull();
    expect(parseExamCreateType("mock")).toBeNull();
    expect(parseExamCreateType(["language", "regular"])).toBe("language");
  });
});

describe("examCreateChoices", () => {
  it("luôn có đủ HAI lựa chọn (khoá ngoại ngữ vẫn cần đề thường)", () => {
    for (const o of [
      { courseLanguageMode: false, appMode: "default" as const },
      { courseLanguageMode: true, appMode: "default" as const },
      { courseLanguageMode: false, appMode: "language" as const },
    ]) {
      expect(examCreateChoices(o).map((c) => c.type).sort()).toEqual(["language", "regular"]);
    }
  });
  it("khoá ngoại ngữ hoặc vỏ Limio Language ⇒ thẻ ngoại ngữ nổi lên trước và được gợi ý", () => {
    for (const o of [
      { courseLanguageMode: true, appMode: "default" as const },
      { courseLanguageMode: false, appMode: "language" as const },
    ]) {
      const c = examCreateChoices(o);
      expect(c[0]).toMatchObject({ type: "language", recommended: true });
      expect(c[1]).toMatchObject({ type: "regular", recommended: false });
    }
  });
  it("khoá thường ở vỏ thường ⇒ đề thường trước (không đổi thói quen), không gợi ý thẻ ngoại ngữ", () => {
    const c = examCreateChoices({ courseLanguageMode: false, appMode: "default" });
    expect(c[0]).toMatchObject({ type: "regular", recommended: false });
    expect(c.every((x) => !x.recommended)).toBe(true);
  });
  it("mỗi thẻ có tên, mô tả và đường dẫn bước kế (?type=)", () => {
    for (const c of examCreateChoices({ courseLanguageMode: true, appMode: "default" })) {
      expect(c.title.length).toBeGreaterThan(3);
      expect(c.description.length).toBeGreaterThan(20);
      expect(c.query).toBe(`type=${c.type}`);
    }
  });
});
