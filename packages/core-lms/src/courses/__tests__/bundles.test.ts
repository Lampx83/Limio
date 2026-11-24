import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { RoleName } from "@feedbackme/shared-types";
import { registerUser } from "../../auth/register";
import { grantRole } from "../../auth/roles";
import { CourseAuthzError } from "../authz";
import { createCourse, publishCourse } from "../courses";
import { BundleError, bundleSavings, createBundle, getBundleBySlug, publishBundle, updateBundle } from "../bundles";

const BASE = "http://localhost:3000";
async function makeUser(email: string) {
  return (await registerUser({ email, password: "password1234", displayName: email }, BASE)).userId;
}
async function makeAdmin(email: string) {
  const id = await makeUser(email);
  await grantRole(id, { targetUserId: id, roleName: RoleName.Admin });
  return id;
}
async function makeCourses(ownerId: string, prefix: string, n: number, opts: { publish?: boolean } = {}) {
  const ids: string[] = [];
  for (let i = 1; i <= n; i++) {
    const c = await createCourse(ownerId, { title: `${prefix} ${i}`, description: "d", slug: `${prefix}-${i}`, personalizationEnabled: false });
    if (opts.publish !== false) await publishCourse(ownerId, c.courseId);
    ids.push(c.courseId);
  }
  return ids;
}
const base = (courseIds: string[], over: Record<string, unknown> = {}) => ({
  slug: "combo-a",
  title: "Trọn bộ A",
  priceCents: 699_000,
  originalPriceCents: 2_995_000,
  durationMonths: 12,
  courseIds,
  ...over,
});

describe("bundleSavings", () => {
  it("tiết kiệm = tổng giá lẻ − giá combo, chỉ khi dương", () => {
    expect(bundleSavings(995_000, 699_000)).toBe(296_000);
    expect(bundleSavings(699_000, 699_000)).toBeNull();
    expect(bundleSavings(500_000, 699_000)).toBeNull();
    expect(bundleSavings(null, 699_000)).toBeNull();
  });
});

describe("createBundle", () => {
  it("admin tạo combo nháp, ghi AuditLog; người không phải admin bị từ chối", async () => {
    const admin = await makeAdmin("bd-admin1@e.com");
    const nonAdmin = await makeUser("bd-user1@e.com");
    const ids = await makeCourses(admin, "bd1", 3);

    await expect(createBundle(nonAdmin, base(ids, { slug: "combo-x1" }))).rejects.toBeInstanceOf(CourseAuthzError);

    const b = await createBundle(admin, base(ids, { slug: "combo-1" }));
    const row = await prisma.courseBundle.findUniqueOrThrow({ where: { id: b.id }, include: { items: { orderBy: { orderIndex: "asc" } } } });
    expect(row.status).toBe("draft");
    expect(row.items.map((i) => i.courseId)).toEqual(ids);
    const audit = await prisma.auditLog.findFirst({ where: { action: "course.bundle.created", payload: { path: ["bundleId"], equals: b.id } } });
    expect(audit).not.toBeNull();
    expect(JSON.stringify(audit!.payload)).not.toContain("Trọn bộ"); // payload không mang tên/mô tả
  });

  it("từ chối: slug trùng, <2 khoá, khoá lặp, khoá không tồn tại, giá gốc ≤ giá bán", async () => {
    const admin = await makeAdmin("bd-admin2@e.com");
    const ids = await makeCourses(admin, "bd2", 2);
    await createBundle(admin, base(ids, { slug: "combo-2" }));

    await expect(createBundle(admin, base(ids, { slug: "combo-2" }))).rejects.toMatchObject({ code: "slug_taken" });
    await expect(createBundle(admin, base([ids[0]!], { slug: "combo-2b" }))).rejects.toMatchObject({ code: "validation_failed" });
    await expect(createBundle(admin, base([ids[0]!, ids[0]!], { slug: "combo-2c" }))).rejects.toMatchObject({ code: "validation_failed" });
    await expect(createBundle(admin, base([ids[0]!, "00000000-0000-0000-0000-000000000000"], { slug: "combo-2d" }))).rejects.toMatchObject({ code: "course_not_found" });
    await expect(createBundle(admin, base(ids, { slug: "combo-2e", originalPriceCents: 699_000 }))).rejects.toMatchObject({ code: "validation_failed" });
    await expect(createBundle(admin, base(ids, { slug: "combo-2f", priceCents: 0 }))).rejects.toBeInstanceOf(BundleError);
  });
});

describe("publishBundle + getBundleBySlug", () => {
  it("chỉ xuất bản khi mọi khoá đã published; nháp không hiện công khai", async () => {
    const admin = await makeAdmin("bd-admin3@e.com");
    const pub = await makeCourses(admin, "bd3a", 2);
    const draft = await makeCourses(admin, "bd3b", 1, { publish: false });
    const b = await createBundle(admin, base([...pub, ...draft], { slug: "combo-3" }));

    await expect(publishBundle(admin, b.id)).rejects.toMatchObject({ code: "courses_not_published", details: { courses: ["bd3b-1"] } });
    expect(await getBundleBySlug("combo-3")).toBeNull(); // nháp: không công khai
    expect((await getBundleBySlug("combo-3", { allowDraft: true }))?.status).toBe("draft");

    await publishCourse(admin, draft[0]!);
    await publishBundle(admin, b.id);
    const view = await getBundleBySlug("combo-3");
    expect(view).toMatchObject({ slug: "combo-3", status: "published", purchasable: true, priceCents: 699_000 });
    expect(view!.courses).toHaveLength(3);
    expect(await prisma.auditLog.findFirst({ where: { action: "course.bundle.published", payload: { path: ["bundleId"], equals: b.id } } })).not.toBeNull();
  });

  it("tiết kiệm so với mua lẻ tính từ gói rẻ nhất của từng khoá; khoá bị gỡ thì combo không còn mua được", async () => {
    const admin = await makeAdmin("bd-admin4@e.com");
    const ids = await makeCourses(admin, "bd4", 2);
    for (const courseId of ids) {
      await prisma.courseAccessPlan.create({ data: { courseId, label: "1 năm", durationMonths: 12, priceCents: 399_000, currency: "VND", createdBy: admin } });
    }
    const b = await createBundle(admin, base(ids, { slug: "combo-4", priceCents: 599_000, originalPriceCents: null }));
    await publishBundle(admin, b.id);

    let view = (await getBundleBySlug("combo-4"))!;
    expect(view.retailTotalCents).toBe(798_000);
    expect(view.savingsCents).toBe(199_000);

    await prisma.course.update({ where: { id: ids[0]! }, data: { status: "draft" } });
    view = (await getBundleBySlug("combo-4"))!;
    expect(view.purchasable).toBe(false);
  });
});

describe("updateBundle", () => {
  it("sửa giá/danh sách khoá; giá gốc phải lớn hơn giá bán đang lưu", async () => {
    const admin = await makeAdmin("bd-admin5@e.com");
    const ids = await makeCourses(admin, "bd5", 3);
    const b = await createBundle(admin, base(ids.slice(0, 2), { slug: "combo-5", originalPriceCents: null }));

    await updateBundle(admin, b.id, { priceCents: 599_000, courseIds: ids });
    const row = await prisma.courseBundle.findUniqueOrThrow({ where: { id: b.id }, include: { items: true } });
    expect(row.priceCents).toBe(599_000);
    expect(row.items).toHaveLength(3);

    await expect(updateBundle(admin, b.id, { originalPriceCents: 599_000 })).rejects.toMatchObject({ code: "validation_failed" });
    await updateBundle(admin, b.id, { originalPriceCents: 1_999_000 });
    await expect(updateBundle(admin, b.id, { priceCents: 2_000_000 })).rejects.toMatchObject({ code: "validation_failed" });
  });
});
