import { describe, expect, it } from "vitest";
import { vi } from "vitest";

vi.mock("@feedbackme/db", () => ({
  prisma: { course: { findMany: vi.fn(async () => [{ slug: "a" }, { slug: "b" }]) } },
}));
vi.mock("../resolve", () => ({
  listSpaces: vi.fn(async () => [
    { slug: "zeta", name: "Zeta", logoUrl: null, limioBrand: false, courses: [{ slug: "a" }, { slug: "x" }] },
    { slug: "hsk", name: "Alpha", logoUrl: null, limioBrand: true, courses: [{ slug: "b" }] },
  ]),
  spaceHomePath: (c: { slug: string }) => (c.slug === "hsk" ? "/hsk" : `/s/${c.slug}`),
}));

import { getCatalogSpaces } from "../catalogSpaces";

describe("getCatalogSpaces", () => {
  it("liệt kê mọi space bật, xếp theo tên, đếm khoá đang xuất bản và dùng URL của space", async () => {
    const out = await getCatalogSpaces();
    expect(out.map((s) => s.name)).toEqual(["Alpha", "Zeta"]);
    expect(out[0]).toMatchObject({ href: "/hsk", limioBrand: true, openCount: 1 });
    expect(out[1]).toMatchObject({ href: "/s/zeta", limioBrand: false, openCount: 1 });
  });
});
