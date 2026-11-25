import { describe, expect, it } from "vitest";
import { buildSpaceConfig, bundleAllowedForOrg, normalizeStored } from "../settings";

const base = { slug: "demo", orgName: "Demo", orgLogoUrl: null };

describe("space: combo hiển thị (chọn tay)", () => {
  it("vắng = tự động (không có khoá bundles trong cấu hình)", () => {
    expect(normalizeStored({}).bundles).toBeUndefined();
    expect("bundles" in buildSpaceConfig({ ...base, stored: normalizeStored({}) })).toBe(false);
  });

  it("giữ thứ tự, bỏ trùng, bỏ slug sai và cắt chuỗi lạ", () => {
    const s = normalizeStored({ bundles: ["b-2", "b-1", "b-2", "Bad Slug", "", 7, null, " b-3 "] });
    expect(s.bundles).toEqual(["b-2", "b-1", "b-3"]);
  });

  it("mảng rỗng được giữ: chủ động không hiện combo", () => {
    const s = normalizeStored({ bundles: [] });
    expect(s.bundles).toEqual([]);
    expect(buildSpaceConfig({ ...base, stored: s }).bundles).toEqual([]);
  });

  it("không phải mảng thì coi như chưa chọn", () => {
    expect(normalizeStored({ bundles: "b-1" }).bundles).toBeUndefined();
  });

  it("giới hạn 24 combo", () => {
    const many = Array.from({ length: 40 }, (_, i) => `b-${i}`);
    expect(normalizeStored({ bundles: many }).bundles).toHaveLength(24);
  });

  it("buildSpaceConfig mang danh sách xuống SpaceConfig", () => {
    const cfg = buildSpaceConfig({ ...base, stored: normalizeStored({ bundles: ["b-1", "b-2"] }) });
    expect(cfg.bundles).toEqual(["b-1", "b-2"]);
  });
});

describe("space: combo của trường khác", () => {
  it("chỉ cho hiện khi mọi khoá thuộc trường này hoặc chưa có chủ", () => {
    expect(bundleAllowedForOrg([null, "org-a"], "org-a")).toBe(true);
    expect(bundleAllowedForOrg([null, null], "org-a")).toBe(true);
    expect(bundleAllowedForOrg(["org-a", "org-b"], "org-a")).toBe(false);
    expect(bundleAllowedForOrg(["org-b"], "org-a")).toBe(false);
  });
});
