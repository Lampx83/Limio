import { describe, expect, it, vi } from "vitest";

const { setting } = vi.hoisted(() => ({ setting: { value: null as string | null } }));
vi.mock("@/lib/site-settings", () => ({ getSiteSetting: vi.fn(async () => setting.value) }));

vi.mock("@feedbackme/db", () => ({
  prisma: {
    course: {
      findMany: vi.fn(async () => [
        { slug: "a", title: "Khoá A", coverUrl: "/c/a.jpg", priceCents: 0, originalPriceCents: null, currency: "VND", accessPlans: [] },
        { slug: "b", title: "Khoá B", coverUrl: null, priceCents: null, originalPriceCents: null, currency: "VND", accessPlans: [{ priceCents: 199000, currency: "VND" }] },
        { slug: "c", title: "Khoá C", coverUrl: "/c/c.jpg", priceCents: null, originalPriceCents: 599000, currency: "VND", accessPlans: [{ priceCents: 199000, currency: "VND" }] },
      ]),
    },
  },
}));
vi.mock("../resolve", () => ({
  listSpaces: vi.fn(async () => [
    { slug: "zeta", name: "Zeta", logoUrl: null, limioBrand: false, courses: [{ slug: "a" }, { slug: "b" }, { slug: "c" }, { slug: "x" }] },
    { slug: "hsk", name: "Alpha", logoUrl: null, limioBrand: true, courses: [{ slug: "c" }, { slug: "zz" }] },
  ]),
  spaceHomePath: (c: { slug: string }) => (c.slug === "hsk" ? "/hsk" : `/s/${c.slug}`),
}));
vi.mock("../hskBundles", () => ({
  getHskBooksByLevel: vi.fn(async () => new Map([[2, [
    { book: 1, slug: "hsk-2-quyen-1", title: "Quyển 1", coverUrl: "/c/q1.jpg", lessonCount: 20, priceCents: 199000, originalPriceCents: 599000, currency: "VND" },
    { book: 2, slug: "hsk-2-quyen-2", title: "Quyển 2", coverUrl: null, lessonCount: 20, priceCents: 199000, originalPriceCents: 599000, currency: "VND" },
  ]]])),
}));

import { getCatalogSpaces, pickSpacePreviews } from "../catalogSpaces";

describe("getCatalogSpaces", () => {
  it("liệt kê mọi space bật, xếp theo tên, đếm khoá đang xuất bản và dùng URL của space", async () => {
    const out = await getCatalogSpaces();
    expect(out.map((s) => s.name)).toEqual(["Alpha", "Zeta"]);
    expect(out[0]).toMatchObject({ href: "/hsk", limioBrand: true, openCount: 1 });
    expect(out[1]).toMatchObject({ href: "/s/zeta", limioBrand: false, openCount: 3 });
  });
  it("xem trước: chỉ khoá có bìa, theo thứ tự space; giá lấy gói rẻ nhất hoặc 0 (miễn phí)", async () => {
    const zeta = (await getCatalogSpaces()).find((s) => s.slug === "zeta")!;
    expect(zeta.previews.map((p) => p.slug)).toEqual(["a", "c"]);
    expect(zeta.previews[0]).toMatchObject({ priceCents: 0 });
    expect(zeta.previews[1]).toMatchObject({ priceCents: 199000, originalPriceCents: 599000 });
  });
  it("space kiểu Limio: cấp có quyển được thay bằng các quyển có bìa", async () => {
    const hsk = (await getCatalogSpaces()).find((s) => s.slug === "hsk")!;
    // Cấp 1 (khoá c) có bìa; cấp 2 có quyển 1 (có bìa) và quyển 2 (không bìa → bỏ).
    expect(hsk.previews.map((p) => p.slug)).toEqual(["c", "hsk-2-quyen-1"]);
  });
});

describe("getCatalogSpaces — admin chọn space", () => {
  it("chọn tay: chỉ các space đã chọn, đúng thứ tự admin đặt; slug không còn bật bị bỏ", async () => {
    setting.value = JSON.stringify(["zeta", "khong-con", "hsk"]);
    const out = await getCatalogSpaces();
    expect(out.map((s) => s.slug)).toEqual(["zeta", "hsk"]);
    setting.value = null;
  });
  it("chọn tay mảng rỗng: ẩn cả mục; dữ liệu hỏng coi như tự động", async () => {
    setting.value = "[]";
    expect(await getCatalogSpaces()).toEqual([]);
    setting.value = "{khong phai json";
    expect((await getCatalogSpaces()).map((s) => s.name)).toEqual(["Alpha", "Zeta"]);
    setting.value = null;
  });
});

describe("pickSpacePreviews", () => {
  const row = (slug: string, cover: string | null) => ({ slug, title: slug, coverUrl: cover, priceCents: 1000, originalPriceCents: null, currency: "VND", planPriceCents: null, planCurrency: null });
  it("tối đa 5, bỏ khoá không có hàng (chưa xuất bản) và khoá không bìa", () => {
    const rows = new Map(["a", "b", "c", "d", "e", "f", "g"].map((s) => [s, row(s, s === "b" ? null : `/${s}.jpg`)]));
    const out = pickSpacePreviews(["a", "b", "c", "d", "e", "f", "g", "h"], false, rows, new Map());
    expect(out.map((p) => p.slug)).toEqual(["a", "c", "d", "e", "f"]);
  });
});
