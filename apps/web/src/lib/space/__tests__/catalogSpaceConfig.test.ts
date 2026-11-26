import { describe, expect, it } from "vitest";
import { MAX_CATALOG_SPACES, applyCatalogSpaceSelection, normalizeSlugs, parseCatalogSpacesSetting, serializeCatalogSpacesSetting } from "../catalogSpaceConfig";

describe("parseCatalogSpacesSetting", () => {
  it("vắng / rỗng / hỏng / không phải mảng → null (tự động)", () => {
    for (const raw of [null, undefined, "", "   ", "{không json", '{"a":1}', '"hsk"']) expect(parseCatalogSpacesSetting(raw as string)).toBeNull();
  });
  it("mảng slug → chọn tay, mảng rỗng giữ là rỗng (ẩn cả mục)", () => {
    expect(parseCatalogSpacesSetting('["hsk","micro4asia"]')).toEqual(["hsk", "micro4asia"]);
    expect(parseCatalogSpacesSetting("[]")).toEqual([]);
  });
});

describe("normalizeSlugs", () => {
  it("bỏ trùng, bỏ slug sai/không phải chuỗi, giữ thứ tự, cắt tối đa", () => {
    expect(normalizeSlugs(["b", "a", "b", "Bad Slug", "", 7, null, " c "])).toEqual(["b", "a", "c"]);
    expect(normalizeSlugs(Array.from({ length: 40 }, (_, i) => `s-${i}`))).toHaveLength(MAX_CATALOG_SPACES);
  });
});

describe("serializeCatalogSpacesSetting", () => {
  it("tự động → chuỗi rỗng; chọn tay → JSON đã làm sạch; đọc lại được", () => {
    expect(serializeCatalogSpacesSetting(null)).toBe("");
    expect(serializeCatalogSpacesSetting(["b", "a", "b"])).toBe('["b","a"]');
    expect(parseCatalogSpacesSetting(serializeCatalogSpacesSetting(["x"]))).toEqual(["x"]);
    expect(parseCatalogSpacesSetting(serializeCatalogSpacesSetting(null))).toBeNull();
  });
});

describe("applyCatalogSpaceSelection", () => {
  const all = [{ slug: "a" }, { slug: "b" }, { slug: "c" }];
  it("tự động giữ nguyên; chọn tay theo thứ tự đã chọn và bỏ slug không còn bật", () => {
    expect(applyCatalogSpaceSelection(all, null)).toBe(all);
    expect(applyCatalogSpaceSelection(all, ["c", "x", "a"]).map((s) => s.slug)).toEqual(["c", "a"]);
    expect(applyCatalogSpaceSelection(all, [])).toEqual([]);
  });
});
