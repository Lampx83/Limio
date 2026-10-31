import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { settleGatewayPayment } from "../orderPayment";
import { isUserEnrolled } from "../enroll";
import { createCourse } from "../../courses/courses";
import { registerUser } from "../../auth/register";

const BASE = "http://localhost:3000";

async function makeUser(email: string) {
  return (await registerUser({ email, password: "password1234", displayName: email }, BASE)).userId;
}

/** Học viên có một đơn VNPay đang chờ thanh toán. */
async function pendingOrder(slug: string, opts: { durationMonths?: number | null; status?: "pending" | "failed" | "paid" | "refunded" } = {}) {
  const owner = await makeUser(`${slug}-owner@e.com`);
  const learner = await makeUser(`${slug}-learner@e.com`);
  const { courseId } = await createCourse(owner, { title: `t ${slug}`, description: "d", slug });
  let accessPlanId: string | null = null;
  if (opts.durationMonths !== undefined) {
    const plan = await prisma.courseAccessPlan.create({
      data: { courseId, label: "Gói", durationMonths: opts.durationMonths, priceCents: 199_000, currency: "VND", createdBy: owner },
    });
    accessPlanId = plan.id;
  }
  const txnRef = `ref${slug.replace(/[^a-z0-9]/g, "")}0123456789abcdef`;
  const order = await prisma.order.create({
    data: { userId: learner, courseId, accessPlanId, amountCents: 199_000, currency: "VND", provider: "vnpay", status: opts.status ?? "pending", providerRef: txnRef },
  });
  return { owner, learner, courseId, order, txnRef };
}

const ok = (txnRef: string, extra: Partial<Parameters<typeof settleGatewayPayment>[0]> = {}) => ({
  provider: "vnpay" as const,
  txnRef,
  paidAmountCents: 199_000,
  success: true,
  gatewayTxnRef: "14012345",
  ...extra,
});

describe("settleGatewayPayment — thành công", () => {
  it("đơn pending → paid, ghi paidAt và mã giao dịch của cổng, cấp quyền vĩnh viễn khi không có gói", async () => {
    const { learner, courseId, order, txnRef } = await pendingOrder("gp-1");
    expect(await isUserEnrolled(learner, courseId)).toBe(false);

    expect(await settleGatewayPayment(ok(txnRef))).toEqual({ result: "paid", orderId: order.id });
    const o = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o).toMatchObject({ status: "paid", gatewayTxnRef: "14012345" });
    expect(o.paidAt).toBeInstanceOf(Date);
    const e = await prisma.enrollment.findUniqueOrThrow({ where: { userId_courseId: { userId: learner, courseId } } });
    expect(e.accessExpiresAt).toBeNull();
    expect(await isUserEnrolled(learner, courseId)).toBe(true);
  });

  it("gói có thời hạn: hạn = bây giờ + số tháng, sự kiện gia hạn ghi nguồn order (không mang mã giao dịch)", async () => {
    const { learner, courseId, txnRef } = await pendingOrder("gp-2", { durationMonths: 12 });
    await settleGatewayPayment(ok(txnRef));
    const e = await prisma.enrollment.findUniqueOrThrow({ where: { userId_courseId: { userId: learner, courseId } } });
    const want = new Date();
    want.setUTCMonth(want.getUTCMonth() + 12);
    expect(Math.abs(e.accessExpiresAt!.getTime() - want.getTime())).toBeLessThan(30_000);
    const ev = await prisma.learningEvent.findFirstOrThrow({ where: { userId: learner, eventType: LearningEventType.EnrollmentAccessExtended } });
    expect(ev.payload).toMatchObject({ durationMonths: 12, via: "order" });
    expect(JSON.stringify(ev.payload)).not.toContain(txnRef);
  });

  it("gia hạn: đã có hạn còn hiệu lực thì cộng dồn", async () => {
    const { learner, courseId, txnRef } = await pendingOrder("gp-3", { durationMonths: 12 });
    await settleGatewayPayment(ok(txnRef));
    const first = (await prisma.enrollment.findUniqueOrThrow({ where: { userId_courseId: { userId: learner, courseId } } })).accessExpiresAt!;
    // đơn thứ hai cùng khoá và gói
    const plan = await prisma.courseAccessPlan.findFirstOrThrow({ where: { courseId } });
    await prisma.order.create({
      data: { userId: learner, courseId, accessPlanId: plan.id, amountCents: 199_000, currency: "VND", provider: "vnpay", status: "pending", providerRef: "gp3second0123456789abcdef" },
    });
    await settleGatewayPayment(ok("gp3second0123456789abcdef"));
    const second = (await prisma.enrollment.findUniqueOrThrow({ where: { userId_courseId: { userId: learner, courseId } } })).accessExpiresAt!;
    const want = new Date(first);
    want.setUTCMonth(want.getUTCMonth() + 12);
    expect(second.getTime()).toBe(want.getTime());
  });

  it("đơn từng bị đánh dấu failed vẫn nhận thanh toán thành công (tiền đã về)", async () => {
    const { learner, courseId, order, txnRef } = await pendingOrder("gp-4", { status: "failed" });
    expect((await settleGatewayPayment(ok(txnRef))).result).toBe("paid");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("paid");
    expect(await isUserEnrolled(learner, courseId)).toBe(true);
  });
});

describe("settleGatewayPayment — idempotent và đua tranh", () => {
  it("gửi lại IPN thành công: lần sau already_confirmed, không gia hạn thêm, không ghi thêm sự kiện", async () => {
    const { learner, courseId, txnRef } = await pendingOrder("gp-5", { durationMonths: 12 });
    await settleGatewayPayment(ok(txnRef));
    const before = (await prisma.enrollment.findUniqueOrThrow({ where: { userId_courseId: { userId: learner, courseId } } })).accessExpiresAt!;

    expect((await settleGatewayPayment(ok(txnRef))).result).toBe("already_confirmed");
    expect((await prisma.enrollment.findUniqueOrThrow({ where: { userId_courseId: { userId: learner, courseId } } })).accessExpiresAt!.getTime()).toBe(before.getTime());
    expect(await prisma.learningEvent.count({ where: { userId: learner, eventType: LearningEventType.EnrollmentAccessExtended } })).toBe(1);
  });

  it("hai bản IPN đồng thời: đúng một bên cấp quyền", async () => {
    const { learner, courseId, txnRef } = await pendingOrder("gp-6", { durationMonths: 12 });
    const [a, b] = await Promise.all([settleGatewayPayment(ok(txnRef)), settleGatewayPayment(ok(txnRef))]);
    expect([a.result, b.result].sort()).toEqual(["already_confirmed", "paid"]);
    expect(await prisma.learningEvent.count({ where: { userId: learner, courseId, eventType: LearningEventType.EnrollmentAccessExtended } })).toBe(1);
  });

  it("đơn đã refunded không bị mở lại thành paid", async () => {
    const { learner, courseId, order, txnRef } = await pendingOrder("gp-7", { status: "refunded" });
    expect((await settleGatewayPayment(ok(txnRef))).result).toBe("already_confirmed");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("refunded");
    expect(await isUserEnrolled(learner, courseId)).toBe(false);
  });
});

describe("settleGatewayPayment — từ chối", () => {
  it("số tiền cổng báo khác số tiền của đơn → amount_mismatch, đơn và quyền không đổi (cả thành công lẫn thất bại)", async () => {
    const { learner, courseId, order, txnRef } = await pendingOrder("gp-8");
    for (const success of [true, false]) {
      expect(await settleGatewayPayment(ok(txnRef, { paidAmountCents: 1_000, success }))).toEqual({ result: "amount_mismatch", orderId: order.id });
    }
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("pending");
    expect(await isUserEnrolled(learner, courseId)).toBe(false);
  });

  it("không có đơn với mã giao dịch đó → order_not_found; đơn của cổng khác không khớp", async () => {
    const { txnRef, order } = await pendingOrder("gp-9");
    expect(await settleGatewayPayment(ok("khongco0123456789"))).toEqual({ result: "order_not_found" });
    await prisma.order.update({ where: { id: order.id }, data: { provider: "stripe" } });
    expect(await settleGatewayPayment(ok(txnRef))).toEqual({ result: "order_not_found" });
  });

  it("cổng báo không thành công: pending → failed, không cấp quyền; báo lại vẫn failed", async () => {
    const { learner, courseId, order, txnRef } = await pendingOrder("gp-10");
    expect(await settleGatewayPayment(ok(txnRef, { success: false }))).toEqual({ result: "failed", orderId: order.id });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("failed");
    expect(await isUserEnrolled(learner, courseId)).toBe(false);
    expect((await settleGatewayPayment(ok(txnRef, { success: false }))).result).toBe("failed");
  });

  it("thất bại đến sau khi đơn đã paid không kéo đơn lùi (IPN cũ đến muộn)", async () => {
    const { learner, courseId, order, txnRef } = await pendingOrder("gp-11");
    await settleGatewayPayment(ok(txnRef));
    expect((await settleGatewayPayment(ok(txnRef, { success: false }))).result).toBe("already_confirmed");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("paid");
    expect(await isUserEnrolled(learner, courseId)).toBe(true);
  });
});
