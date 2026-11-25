import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { settleGatewayPayment } from "../orderPayment";
import { isUserEnrolled } from "../enroll";
import { createCourse, publishCourse } from "../../courses/courses";
import { registerUser } from "../../auth/register";

const BASE = "http://localhost:3000";
async function makeUser(email: string) {
  return (await registerUser({ email, password: "password1234", displayName: email }, BASE)).userId;
}

describe("settleGatewayPayment — provider sepay_pg (IPN cổng SePay)", () => {
  it("đúng mã hoá đơn và số tiền → paid + ghi danh 1 năm; IPN gửi lại không cấp thêm; sai số tiền không đổi gì", async () => {
    const owner = await makeUser("pg-owner@e.com");
    const learner = await makeUser("pg-learner@e.com");
    const { courseId } = await createCourse(owner, { title: "pg", description: "d", slug: "pg-1", personalizationEnabled: false });
    await publishCourse(owner, courseId);
    const plan = await prisma.courseAccessPlan.create({
      data: { courseId, label: "1 năm", durationMonths: 12, priceCents: 199_000, currency: "VND", createdBy: owner },
    });
    const order = await prisma.order.create({
      data: { userId: learner, courseId, accessPlanId: plan.id, amountCents: 199_000, currency: "VND", provider: "sepay_pg", status: "pending", providerRef: "LMPGTEST0001" },
    });
    const ipn = (amount: number) => ({ provider: "sepay_pg" as const, txnRef: "LMPGTEST0001", paidAmountCents: amount, success: true, gatewayTxnRef: "TXN-1" });

    expect(await settleGatewayPayment(ipn(1))).toEqual({ result: "amount_mismatch", orderId: order.id });
    expect(await isUserEnrolled(learner, courseId)).toBe(false);

    expect(await settleGatewayPayment(ipn(199_000))).toEqual({ result: "paid", orderId: order.id });
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({ status: "paid", gatewayTxnRef: "TXN-1" });
    const e = await prisma.enrollment.findUniqueOrThrow({ where: { userId_courseId: { userId: learner, courseId } } });
    expect((e.accessExpiresAt!.getTime() - Date.now()) / (30 * 24 * 3600 * 1000)).toBeGreaterThan(11);

    expect(await settleGatewayPayment(ipn(199_000))).toEqual({ result: "already_confirmed", orderId: order.id });
    expect(await settleGatewayPayment({ ...ipn(199_000), txnRef: "KHONGCO" })).toEqual({ result: "order_not_found" });
  });
});
