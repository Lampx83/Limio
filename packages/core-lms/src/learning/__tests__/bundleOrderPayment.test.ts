import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { RoleName } from "@feedbackme/shared-types";
import { settleGatewayPayment } from "../orderPayment";
import { processChargeRefund } from "../orderRefund";
import { isUserEnrolled } from "../enroll";
import { extendEnrollmentAccess } from "../courseAccess";
import { createCourse, publishCourse } from "../../courses/courses";
import { createBundle } from "../../courses/bundles";
import { registerUser } from "../../auth/register";
import { grantRole } from "../../auth/roles";

const BASE = "http://localhost:3000";
async function makeUser(email: string) {
  return (await registerUser({ email, password: "password1234", displayName: email }, BASE)).userId;
}

/** Combo 3 khoá + học viên có một đơn combo VNPay đang chờ. */
async function pendingBundleOrder(tag: string, durationMonths: number | null = 12) {
  const admin = await makeUser(`${tag}-admin@e.com`);
  await grantRole(admin, { targetUserId: admin, roleName: RoleName.Admin });
  const learner = await makeUser(`${tag}-learner@e.com`);
  const courseIds: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const c = await createCourse(admin, { title: `${tag} ${i}`, description: "d", slug: `${tag}-${i}`, personalizationEnabled: false });
    await publishCourse(admin, c.courseId);
    courseIds.push(c.courseId);
  }
  const bundle = await createBundle(admin, { slug: `combo-${tag}`, title: "Combo", priceCents: 699_000, durationMonths, courseIds });
  const txnRef = `ref${tag.replace(/[^a-z0-9]/g, "")}0123456789abcdef`;
  const order = await prisma.order.create({
    data: { userId: learner, courseId: null, bundleId: bundle.id, amountCents: 699_000, currency: "VND", provider: "vnpay", status: "pending", providerRef: txnRef },
  });
  return { admin, learner, courseIds, bundle, order, txnRef };
}
const ok = (txnRef: string, extra: Partial<Parameters<typeof settleGatewayPayment>[0]> = {}) => ({
  provider: "vnpay" as const,
  txnRef,
  paidAmountCents: 699_000,
  success: true,
  gatewayTxnRef: "99887766",
  ...extra,
});

describe("settleGatewayPayment — đơn combo", () => {
  it("paid → ghi danh MỌI khoá của combo với cùng thời hạn", async () => {
    const { learner, courseIds, order, txnRef } = await pendingBundleOrder("cb-1");
    expect(await settleGatewayPayment(ok(txnRef))).toEqual({ result: "paid", orderId: order.id });

    const o = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o).toMatchObject({ status: "paid", gatewayTxnRef: "99887766", courseId: null });
    for (const courseId of courseIds) {
      expect(await isUserEnrolled(learner, courseId)).toBe(true);
      const e = await prisma.enrollment.findUniqueOrThrow({ where: { userId_courseId: { userId: learner, courseId } } });
      expect(e.accessExpiresAt).not.toBeNull();
      const months = (e.accessExpiresAt!.getTime() - Date.now()) / (30 * 24 * 3600 * 1000);
      expect(months).toBeGreaterThan(11);
      expect(months).toBeLessThan(12.5);
    }
  });

  it("combo vĩnh viễn (durationMonths = null) → quyền không hết hạn", async () => {
    const { learner, courseIds, txnRef } = await pendingBundleOrder("cb-2", null);
    await settleGatewayPayment(ok(txnRef));
    for (const courseId of courseIds) {
      const e = await prisma.enrollment.findUniqueOrThrow({ where: { userId_courseId: { userId: learner, courseId } } });
      expect(e.accessExpiresAt).toBeNull();
    }
  });

  it("đã mua lẻ một khoá còn hạn → hạn của khoá đó cộng dồn, các khoá khác mở mới", async () => {
    const { learner, courseIds, txnRef } = await pendingBundleOrder("cb-3");
    const first = courseIds[0]!;
    // Mua lẻ trước: gói 1 tháng còn hạn (đi đúng đường cấp quyền thật).
    const course = await prisma.course.findUniqueOrThrow({ where: { id: first }, select: { id: true, version: true } });
    await extendEnrollmentAccess(learner, course, { id: null, durationMonths: 1 }, prisma, { via: "order" });

    await settleGatewayPayment(ok(txnRef));
    const e = await prisma.enrollment.findUniqueOrThrow({ where: { userId_courseId: { userId: learner, courseId: first } } });
    // 1 tháng còn lại + 12 tháng của combo
    expect((e.accessExpiresAt!.getTime() - Date.now()) / (30 * 24 * 3600 * 1000)).toBeGreaterThan(12.5);
    expect(await isUserEnrolled(learner, courseIds[1]!)).toBe(true);
  });

  it("IPN gửi lại chỉ cấp một lần; số tiền sai không đổi gì; thất bại không ghi danh", async () => {
    const a = await pendingBundleOrder("cb-4");
    expect(await settleGatewayPayment(ok(a.txnRef))).toMatchObject({ result: "paid" });
    const before = await prisma.enrollment.findMany({ where: { userId: a.learner }, orderBy: { courseId: "asc" } });
    expect(await settleGatewayPayment(ok(a.txnRef))).toMatchObject({ result: "already_confirmed" });
    const after = await prisma.enrollment.findMany({ where: { userId: a.learner }, orderBy: { courseId: "asc" } });
    expect(after.map((e) => e.accessExpiresAt?.getTime())).toEqual(before.map((e) => e.accessExpiresAt?.getTime()));

    const b = await pendingBundleOrder("cb-5");
    expect(await settleGatewayPayment(ok(b.txnRef, { paidAmountCents: 100 }))).toMatchObject({ result: "amount_mismatch" });
    expect(await prisma.enrollment.count({ where: { userId: b.learner } })).toBe(0);

    const c = await pendingBundleOrder("cb-6");
    expect(await settleGatewayPayment(ok(c.txnRef, { success: false }))).toMatchObject({ result: "failed" });
    expect(await prisma.enrollment.count({ where: { userId: c.learner } })).toBe(0);
  });

  it("khoá thêm vào combo SAU khi tạo đơn: cấp theo danh sách lúc thanh toán", async () => {
    const { admin, learner, bundle, txnRef } = await pendingBundleOrder("cb-7");
    const extra = await createCourse(admin, { title: "cb-7 extra", description: "d", slug: "cb-7-extra", personalizationEnabled: false });
    await publishCourse(admin, extra.courseId);
    await prisma.courseBundleItem.create({ data: { bundleId: bundle.id, courseId: extra.courseId, orderIndex: 9 } });

    await settleGatewayPayment(ok(txnRef));
    expect(await isUserEnrolled(learner, extra.courseId)).toBe(true);
    expect(await prisma.enrollment.count({ where: { userId: learner } })).toBe(4);
  });
});

describe("không làm hỏng đường cũ", () => {
  it("đơn combo đi vào hoàn tiền Stripe thì bị bỏ qua an toàn (unsupported_order)", async () => {
    const { order } = await pendingBundleOrder("cb-8");
    await prisma.order.update({ where: { id: order.id }, data: { status: "paid", paymentIntentRef: "pi_combo_test" } });
    expect(await processChargeRefund({ paymentIntentRef: "pi_combo_test", refundedCents: 699_000, fullyRefunded: true })).toEqual({
      result: "unsupported_order",
      orderId: order.id,
    });
  });
});
