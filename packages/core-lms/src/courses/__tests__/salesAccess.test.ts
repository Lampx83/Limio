import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import {
  assertCanManageCourseSales,
  canManageCourseSales,
  listPublisherCourses,
  listPublisherOrgs,
} from "../salesAccess";
import { canEditCourse, CourseAuthzError } from "../authz";
import { createCourse } from "../courses";
import { registerUser } from "../../auth/register";
import { listPublisherOrders, orderPublicCode, OrderRefundError, refundOrderByPublisher } from "../../learning/orderRefund";
import { resolveDefaultSectionId } from "../../learning/enroll";
import { listReportCourses } from "../../reports/access";

const BASE = "http://localhost:3000";
let seq = 0;

async function makeUser(tag: string) {
  return (await registerUser({ email: `${tag}-${++seq}-${Date.now()}@sa.test`, password: "password1234", displayName: tag }, BASE)).userId;
}

async function makeOrg(kind: "school" | "center" | "publisher") {
  return prisma.organization.create({ data: { code: `sa-${kind}-${++seq}-${Date.now()}`, name: `Org ${kind} ${seq}`, kind } });
}

/** Một nhà xuất bản có admin, một khoá thuộc nhà xuất bản (chủ khoá là người khác), một học viên đã trả tiền. */
async function publisherFixture(kind: "school" | "center" | "publisher" = "publisher") {
  const org = await makeOrg(kind);
  const admin = await makeUser("admin");
  await prisma.organizationAdmin.create({ data: { organizationId: org.id, userId: admin } });
  const owner = await makeUser("owner");
  const slug = `sa-c-${++seq}-${Date.now()}`;
  const { courseId } = await createCourse(owner, { title: `Sách ${slug}`, description: "d", slug });
  await prisma.course.update({ where: { id: courseId }, data: { organizationId: org.id, priceCents: 199_000, currency: "VND" } });
  const learner = await makeUser("learner");
  const order = await prisma.order.create({
    data: { userId: learner, courseId, amountCents: 199_000, currency: "VND", provider: "vnpay", status: "paid", providerRef: `ref-${slug}`, paidAt: new Date() },
  });
  const sectionId = await resolveDefaultSectionId(courseId, prisma);
  await prisma.enrollment.create({ data: { userId: learner, courseId, sectionId, courseVersion: 1, status: "active" } });
  return { org, admin, owner, courseId, learner, order };
}

describe("quyền bán hàng của khoá (khu nhà xuất bản)", () => {
  it("quản trị nhà xuất bản được quản lý bán hàng nhưng KHÔNG sửa được nội dung khoá", async () => {
    const f = await publisherFixture();
    expect(await canManageCourseSales(f.admin, f.courseId)).toBe(true);
    expect(await canEditCourse(f.admin, f.courseId)).toBe(false);
    await expect(assertCanManageCourseSales(f.admin, f.courseId)).resolves.toBeUndefined();
  });

  it("chủ khoá vẫn được như trước; người lạ thì không", async () => {
    const f = await publisherFixture();
    expect(await canManageCourseSales(f.owner, f.courseId)).toBe(true);
    const stranger = await makeUser("stranger");
    expect(await canManageCourseSales(stranger, f.courseId)).toBe(false);
    await expect(assertCanManageCourseSales(stranger, f.courseId)).rejects.toBeInstanceOf(CourseAuthzError);
  });

  it("quản trị trường thường hay trung tâm KHÔNG có quyền bán hàng", async () => {
    for (const kind of ["school", "center"] as const) {
      const f = await publisherFixture(kind);
      expect(await canManageCourseSales(f.admin, f.courseId)).toBe(false);
    }
  });

  it("quản trị nhà xuất bản khác không đụng được khoá của nhà này", async () => {
    const f = await publisherFixture();
    const other = await publisherFixture();
    expect(await canManageCourseSales(other.admin, f.courseId)).toBe(false);
  });

  it("listPublisherOrgs chỉ trả nhà xuất bản của mình; listPublisherCourses đếm mã chưa dùng và đơn đã trả", async () => {
    const f = await publisherFixture();
    const school = await makeOrg("school");
    await prisma.organizationAdmin.create({ data: { organizationId: school.id, userId: f.admin } });
    expect((await listPublisherOrgs(f.admin)).map((o) => o.id)).toEqual([f.org.id]);

    await prisma.courseAccessCode.create({ data: { courseId: f.courseId, code: `SA-${Date.now()}-${++seq}`, createdBy: f.owner } });
    const rows = await listPublisherCourses(f.admin, f.org.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: f.courseId, unusedCodes: 1, paidOrders: 1 });

    await expect(listPublisherCourses(f.admin, school.id)).rejects.toBeInstanceOf(CourseAuthzError);
  });

  it("báo cáo lọc theo tổ chức khi được chỉ định", async () => {
    const f = await publisherFixture();
    await prisma.organizationAdmin.create({ data: { organizationId: (await makeOrg("publisher")).id, userId: f.admin } });
    const all = await listReportCourses(f.admin);
    const onlyOne = await listReportCourses(f.admin, prisma, f.org.id);
    expect(onlyOne.map((c) => c.id)).toEqual([f.courseId]);
    expect(all.length).toBeGreaterThanOrEqual(onlyOne.length);
  });
});

describe("đơn và hoàn tiền của nhà xuất bản", () => {
  it("danh sách đơn KHÔNG chứa danh tính người mua", async () => {
    const f = await publisherFixture();
    const orders = await listPublisherOrders(f.admin, f.courseId);
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({ id: f.order.id, code: orderPublicCode(f.order), status: "paid", amountCents: 199_000 });
    const json = JSON.stringify(orders);
    expect(json).not.toContain(f.learner);
    expect(json).not.toMatch(/@sa\.test/);
    expect(json).not.toContain("userId");
  });

  it("tìm theo mã đơn; người không có quyền không xem được", async () => {
    const f = await publisherFixture();
    // Mã người mua thấy trong email là mã cổng thanh toán (providerRef); đơn không có thì là 8 ký tự đầu của id.
    expect(await listPublisherOrders(f.admin, f.courseId, { code: orderPublicCode(f.order).toLowerCase() })).toHaveLength(1);
    expect(await listPublisherOrders(f.admin, f.courseId, { code: f.order.id.slice(0, 8) })).toHaveLength(1);
    expect(await listPublisherOrders(f.admin, f.courseId, { code: "00000000" })).toHaveLength(0);
    const other = await publisherFixture();
    await expect(listPublisherOrders(other.admin, f.courseId)).rejects.toBeInstanceOf(CourseAuthzError);
  });

  it("hoàn tay: đơn → refunded, đóng quyền học, ghi nhật ký người thao tác; idempotent", async () => {
    const f = await publisherFixture();
    const r = await refundOrderByPublisher(f.admin, f.order.id);
    expect(r).toEqual({ orderId: f.order.id, alreadyRefunded: false, enrollmentRevoked: true });
    const o = await prisma.order.findUniqueOrThrow({ where: { id: f.order.id } });
    expect(o.status).toBe("refunded");
    expect(o.refundedCents).toBe(199_000);
    const e = await prisma.enrollment.findUniqueOrThrow({ where: { userId_courseId: { userId: f.learner, courseId: f.courseId } } });
    expect(e.status).toBe("refunded");
    const audit = await prisma.auditLog.findMany({ where: { action: "order.refunded_by_publisher", actorUserId: f.admin } });
    expect(audit).toHaveLength(1);
    expect(audit[0]!.payload).toMatchObject({ orderId: f.order.id, courseId: f.courseId });

    const again = await refundOrderByPublisher(f.admin, f.order.id);
    expect(again).toEqual({ orderId: f.order.id, alreadyRefunded: true, enrollmentRevoked: false });
    expect(await prisma.auditLog.count({ where: { action: "order.refunded_by_publisher", actorUserId: f.admin } })).toBe(1);
  });

  it("học viên còn lý do giữ quyền (một đơn paid khác) thì chỉ đơn đổi trạng thái", async () => {
    const f = await publisherFixture();
    await prisma.order.create({
      data: { userId: f.learner, courseId: f.courseId, amountCents: 1, currency: "VND", provider: "vnpay", status: "paid", providerRef: `ref2-${f.order.id}`, paidAt: new Date() },
    });
    const r = await refundOrderByPublisher(f.admin, f.order.id);
    expect(r.enrollmentRevoked).toBe(false);
    const e = await prisma.enrollment.findUniqueOrThrow({ where: { userId_courseId: { userId: f.learner, courseId: f.courseId } } });
    expect(e.status).toBe("active");
  });

  it("quản trị nhà xuất bản khác hoàn đơn không phải của mình → báo như không có đơn, không đổi gì", async () => {
    const f = await publisherFixture();
    const other = await publisherFixture();
    await expect(refundOrderByPublisher(other.admin, f.order.id)).rejects.toMatchObject({ code: "order_not_found" });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: f.order.id } })).status).toBe("paid");
  });

  it("đơn chưa trả tiền không hoàn được; đơn không có → order_not_found", async () => {
    const f = await publisherFixture();
    const pending = await prisma.order.create({
      data: { userId: f.learner, courseId: f.courseId, amountCents: 5, currency: "VND", provider: "vnpay", status: "pending", providerRef: `ref3-${f.order.id}` },
    });
    await expect(refundOrderByPublisher(f.admin, pending.id)).rejects.toBeInstanceOf(OrderRefundError);
    await expect(refundOrderByPublisher(f.admin, "00000000-0000-0000-0000-000000000000")).rejects.toMatchObject({ code: "order_not_found" });
  });
});
