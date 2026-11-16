import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PASSAGE_LOOKS, passageLook } from "./passageLook";

describe("passageLook", () => {
  it("nhận từng kiểu trong danh sách", () => {
    for (const look of PASSAGE_LOOKS) expect(passageLook({ type: "doc", content: [], look })).toBe(look);
  });

  it("thiếu, rỗng hoặc giá trị lạ thì không có kiểu", () => {
    expect(passageLook({ type: "doc", content: [] })).toBeNull();
    expect(passageLook({ look: "" })).toBeNull();
    expect(passageLook({ look: "comic-sans" })).toBeNull();
    expect(passageLook({ look: 3 })).toBeNull();
    expect(passageLook(null)).toBeNull();
    expect(passageLook(undefined)).toBeNull();
  });

  it("khớp danh sách kiểu của importer (core-lms không import apps/web nên lặp một bản)", () => {
    const src = readFileSync(join(__dirname, "../../../../packages/core-lms/scripts/practice-spec.ts"), "utf8");
    const m = src.match(/PASSAGE_LOOKS\s*=\s*\[([^\]]*)\]/);
    if (!m) throw new Error("practice-spec.ts không còn khai báo PASSAGE_LOOKS");
    const importerLooks = [...(m[1] ?? "").matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    expect(importerLooks).toEqual([...PASSAGE_LOOKS]);
  });

  it("mỗi kiểu có khối CSS .pv-<kiểu> trong globals.css", () => {
    const css = readFileSync(join(__dirname, "../app/globals.css"), "utf8");
    for (const look of PASSAGE_LOOKS) expect(css).toMatch(new RegExp(`\\.pv-${look}[\\s{]`));
  });
});
