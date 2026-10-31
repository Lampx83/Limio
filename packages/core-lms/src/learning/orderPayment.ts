import { prisma, type PaymentProvider, type PrismaClient } from "@feedbackme/db";
import { extendEnrollmentAccess } from "./courseAccess";

/**
 * Cấp quyền học khi cổng thanh toán nội địa (VNPay…) báo kết quả server-to-server (docs/tieu-chi/thanh-toan-vnpay.md,
 * AC3). Không biết gì về chữ ký hay định dạng của cổng: route đã kiểm chữ ký, ở đây chỉ còn chuyện đơn hàng.
 *
 * Idempotent và an toàn trước đua tranh: cổng gửi lại IPN tới 10 lần, và có thể gửi hai bản cùng lúc.
 */

export interface GatewayPaymentResult {
  provider: Extract<PaymentProvider, "vnpay" | "momo">;
  /** Mã giao dịch của Limio gửi cho cổng (`Order.providerRef`). */
  txnRef: string;
  /** Số tiền cổng báo đã thu, đã quy về đơn vị của `Order.amountCents`. */
  paidAmountCents: number;
  /** Cổng báo thành công (mọi điều kiện của cổng đều đạt). */
  success: boolean;
  /** Mã giao dịch phía cổng, để đối soát. */
  gatewayTxnRef?: string | null;
}

export type GatewayPaymentOutcome =
  | { result: "order_not_found" }
  /** Số tiền cổng báo khác số tiền của đơn: không đổi gì. */
  | { result: "amount_mismatch"; orderId: string }
  /** Đơn đã `paid` / `refunded`, hoặc một bản khác vừa xử lý xong. */
  | { result: "already_confirmed"; orderId: string }
  | { result: "paid"; orderId: string }
  /** Cổng báo không thành công: đơn `pending` → `failed`. */
  | { result: "failed"; orderId: string };

export async function settleGatewayPayment(
  input: GatewayPaymentResult,
  db: PrismaClient = prisma,
): Promise<GatewayPaymentOutcome> {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findFirst({ where: { provider: input.provider, providerRef: input.txnRef } });
    if (!order) return { result: "order_not_found" };
    if (input.paidAmountCents !== order.amountCents) return { result: "amount_mismatch", orderId: order.id };
    if (order.status === "paid" || order.status === "refunded") {
      return { result: "already_confirmed", orderId: order.id };
    }

    if (!input.success) {
      if (order.status === "pending") {
        await tx.order.updateMany({ where: { id: order.id, status: "pending" }, data: { status: "failed" } });
      }
      return { result: "failed", orderId: order.id };
    }

    // `failed` vẫn nhận thanh toán thành công: tiền đã về thì quyền phải được cấp dù đơn từng bị đánh dấu thất bại
    // (người mua bấm "quay lại" rồi vẫn trả ở tab cũ). Điều kiện trạng thái trong updateMany là chốt chống đua.
    const flipped = await tx.order.updateMany({
      where: { id: order.id, status: { in: ["pending", "failed"] } },
      data: { status: "paid", paidAt: new Date(), gatewayTxnRef: input.gatewayTxnRef ?? null },
    });
    if (flipped.count === 0) return { result: "already_confirmed", orderId: order.id };

    const course = await tx.course.findUniqueOrThrow({
      where: { id: order.courseId },
      select: { id: true, version: true },
    });
    const plan = order.accessPlanId
      ? await tx.courseAccessPlan.findUniqueOrThrow({
          where: { id: order.accessPlanId },
          select: { id: true, durationMonths: true },
        })
      : { id: null, durationMonths: null };
    // Cùng một đường cấp quyền với Stripe: null durationMonths = vĩnh viễn; gói có hạn thì cộng dồn.
    await extendEnrollmentAccess(order.userId, course, plan, tx as typeof prisma, { via: "order" });
    return { result: "paid", orderId: order.id };
  });
}
