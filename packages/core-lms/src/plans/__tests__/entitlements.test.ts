import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@feedbackme/db";
import { FLAGS } from "@feedbackme/db/feature-flag-catalog";
import { PLAN_CATALOG, TECH_CEILINGS } from "../config";
import { mergeEntitlements, mergeValues, validateEntitlements, PlanError } from "../entitlements";

const flagsDef = [
  { key: "teaching_tools.access", valueType: "boolean", sellable: false },
  { key: "storage.mb", valueType: "int", sellable: true },
  { key: "ai.enabled", valueType: "boolean", sellable: true },
];

describe("mergeEntitlements", () => {
  it("gộp int lấy MAX, boolean OR, bỏ khoá không ai có", () => {
    const flags = [
      { key: "a", valueType: "int" },
      { key: "b", valueType: "boolean" },
      { key: "c", valueType: "int" },
    ];
    expect(mergeEntitlements(flags, [{ a: 30, b: false }, { a: 125, b: true }])).toEqual({ a: 125, b: true });
  });
  it("danh sách rỗng cho kết quả rỗng", () => {
    expect(mergeEntitlements([{ key: "a", valueType: "int" }], [])).toEqual({});
  });
  it("mergeValues string_array hợp nhất", () => {
    expect(mergeValues("string_array", [["x"], ["y", "x"]])).toEqual(["x", "y"]);
  });
});

describe("validateEntitlements", () => {
  const code = (c: string) => expect.objectContaining({ code: c });
  it("từ chối khoá không sellable", () => {
    expect(() => validateEntitlements({ "teaching_tools.access": true }, flagsDef)).toThrow(code("non_sellable_key"));
  });
  it("từ chối sai kiểu", () => {
    expect(() => validateEntitlements({ "storage.mb": "20" }, flagsDef)).toThrow(code("invalid_value_type"));
    expect(() => validateEntitlements({ "storage.mb": 1.5 }, flagsDef)).toThrow(code("invalid_value_type"));
    expect(() => validateEntitlements({ "storage.mb": -1 }, flagsDef)).toThrow(code("invalid_value_type"));
    expect(() => validateEntitlements({ "storage.mb": null }, flagsDef)).toThrow(code("invalid_value_type"));
    expect(() => validateEntitlements({ "ai.enabled": 1 }, flagsDef)).toThrow(code("invalid_value_type"));
  });
  it("từ chối int vượt trần kỹ thuật, kèm max; bằng trần thì chấp nhận", () => {
    expect(() => validateEntitlements({ "storage.mb": TECH_CEILINGS["storage.mb"]! + 1 }, flagsDef)).toThrow(
      expect.objectContaining({ code: "invalid_value_type", details: { key: "storage.mb", max: TECH_CEILINGS["storage.mb"] } }),
    );
    expect(validateEntitlements({ "storage.mb": TECH_CEILINGS["storage.mb"]! }, flagsDef)).toEqual({
      "storage.mb": TECH_CEILINGS["storage.mb"],
    });
  });
  it("từ chối khoá lạ", () => {
    expect(() => validateEntitlements({ "x.y": 1 }, flagsDef)).toThrow(code("unknown_key"));
  });
  it("từ chối đầu vào không phải object", () => {
    for (const bad of [[], null, "s", 3])
      expect(() => validateEntitlements(bad, flagsDef)).toThrow(code("invalid_value_type"));
  });
  it("chấp nhận đầu vào hợp lệ", () => {
    expect(validateEntitlements({ "storage.mb": 0, "ai.enabled": true }, flagsDef)).toEqual({ "storage.mb": 0, "ai.enabled": true });
    expect(new PlanError("unknown_key")).toBeInstanceOf(Error);
  });
});

describe("danh mục gói so với cờ thật", () => {
  beforeEach(async () => {
    for (const f of FLAGS) {
      await prisma.featureFlag.upsert({
        where: { key: f.key },
        update: { valueType: f.valueType, sellable: f.sellable },
        create: f,
      });
    }
  });
  it("mọi gói trong PLAN_CATALOG chỉ dùng khoá sellable đúng kiểu", async () => {
    const flags = await prisma.featureFlag.findMany();
    for (const p of PLAN_CATALOG) expect(() => validateEntitlements(p.entitlements, flags)).not.toThrow();
  });
});
