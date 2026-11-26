import { describe, it, expect, afterEach } from "vitest";
import { PLAN_CATALOG, TECH_CEILINGS, TRIAL_ENDS_AT, plansEnabled } from "../config";

describe("danh mục gói", () => {
  it("gói dùng thử không thấp hơn gói tham chiếu ở bất kỳ khoá nào", () => {
    const trials = PLAN_CATALOG.filter((p) => p.referencePlanKey);
    expect(trials.length).toBe(2);
    for (const t of trials) {
      const ref = PLAN_CATALOG.find((p) => p.key === t.referencePlanKey)!;
      for (const [k, v] of Object.entries(ref.entitlements)) {
        if (typeof v === "number") expect(t.entitlements[k]).toBeGreaterThanOrEqual(v);
        if (v === true) expect(t.entitlements[k]).toBe(true);
      }
    }
  });
  it("gói dùng thử không chứa center.access nhưng bật limio_live.access và ai_oral.access", () => {
    for (const t of PLAN_CATALOG.filter((p) => p.referencePlanKey)) {
      expect(Object.prototype.hasOwnProperty.call(t.entitlements, "center.access")).toBe(false);
      expect(t.entitlements["limio_live.access"]).toBe(true);
      expect(t.entitlements["ai_oral.access"]).toBe(true);
    }
  });
  it("không giá trị nào vượt trần kỹ thuật", () => {
    for (const p of PLAN_CATALOG)
      for (const [k, v] of Object.entries(p.entitlements))
        if (typeof v === "number") expect(v).toBeLessThanOrEqual(TECH_CEILINGS[k]!);
  });
  it("TRIAL_ENDS_AT là 01/03/2027 00:00 giờ VN", () => {
    expect(TRIAL_ENDS_AT.toISOString()).toBe("2027-02-28T17:00:00.000Z");
  });
  it("khoá org.* chỉ ở gói tổ chức", () => {
    for (const p of PLAN_CATALOG.filter((x) => x.scope === "individual"))
      expect(Object.keys(p.entitlements).some((k) => k.startsWith("org."))).toBe(false);
  });
});

describe("plansEnabled", () => {
  const old = process.env.PLANS_ENABLED;
  afterEach(() => {
    if (old === undefined) delete process.env.PLANS_ENABLED;
    else process.env.PLANS_ENABLED = old;
  });
  it("đọc môi trường mỗi lần gọi", () => {
    delete process.env.PLANS_ENABLED;
    expect(plansEnabled()).toBe(false);
    process.env.PLANS_ENABLED = "1";
    expect(plansEnabled()).toBe(true);
    process.env.PLANS_ENABLED = "true";
    expect(plansEnabled()).toBe(true);
    process.env.PLANS_ENABLED = "0";
    expect(plansEnabled()).toBe(false);
  });
});
