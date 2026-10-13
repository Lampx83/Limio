import { describe, expect, it } from "vitest";
import { oralUiText, resolveOralUiLang } from "./oralUiText";

describe("oralUiText", () => {
  it("resolves the UI language from the exam language; zh falls back to Vietnamese", () => {
    expect(resolveOralUiLang("en")).toBe("en");
    expect(resolveOralUiLang("vi")).toBe("vi");
    expect(resolveOralUiLang("zh")).toBe("vi");
    expect(resolveOralUiLang(undefined)).toBe("vi");
  });

  it("English covers exactly the same error codes as Vietnamese", () => {
    expect(Object.keys(oralUiText("en").errors).sort()).toEqual(Object.keys(oralUiText("vi").errors).sort());
  });

  it("English strings contain no Vietnamese diacritics", () => {
    const vietnamese = /[ăâđêôơưàáạảãèéẹẻẽìíịỉĩòóọỏõùúụủũỳýỵỷỹ]/i;
    const walk = (v: unknown, path: string): string[] => {
      if (typeof v === "string") return vietnamese.test(v) ? [`${path}: ${v}`] : [];
      if (typeof v === "function") {
        // gọi thử với đối số mẫu để kiểm cả chuỗi sinh động
        const out = (v as (...a: unknown[]) => unknown)(2, 3, true);
        return walk(out, `${path}()`);
      }
      if (v && typeof v === "object") return Object.entries(v).flatMap(([k, x]) => walk(x, `${path}.${k}`));
      return [];
    };
    expect(walk(oralUiText("en"), "en")).toEqual([]);
  });
});
