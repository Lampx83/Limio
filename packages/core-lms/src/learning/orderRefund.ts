import { prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { emitEvent } from "./events";

/**
 * AC4 — hoàn tiền trên Stripe thu hồi quyền học (docs/tieu-chi/hoc-lieu-nha-xuat-ban-P0.md).
 *
 * Gọi từ webhook `charge.refunded`. Hàm này không biết gì về Stripe: nhận mấy con số đã rút ra từ Charge và
 * trả kết quả để webhook ghi log. Idempotent — Stripe gửi lại hoặc đảo thứ tự sự kiện vẫn ra cùng trạng thái.
 */

export interface ChargeRefundFacts {
  /** PaymentIntent của charge — khoá để tìm đơn (`Order.paymentIntentRef`). */
  paymentIntentRef: string;
  /** Tổng số tiền đã hoàn tính tới sự kiện này (cộng dồn theo Stripe), đơn vị nhỏ nhất của currency. */
  refundedCents: number;
  /** Charge đã được hoàn hết. */
  fullyRefunded: boolean;
}

export type ChargeRefundOutcome =
  /** Không có đơn nào mang payment_intent này (đơn trước AC4, hoặc charge không thuộc Limio). */
  | { result: "order_not_found" }
  /** Đơn chưa `paid` (pending / failed) nên không có quyền học nào để thu hồi. */
  | { result: "not_paid"; orderId: string }
  /** Hoàn một phần: đơn vẫn `paid`, quyền giữ nguyên, chỉ ghi số tiền đã hoàn. */
  | { result: "partial"; orderId: string }
  /** Sự kiện đã được xử lý trước đó. */
  | { result: "already_refunded"; orderId: string }
  /** Hoàn toàn bộ. `enrollmentRevoked=false` khi học viên còn lý do khác để giữ quyền (hoặc không có ghi danh). */
  | { result: "refunded"; orderId: string; enrollmentRevoked: boolean };

export async function processChargeRefund(
  facts: ChargeRefundFacts,
  db: PrismaClient = prisma,
): Promise<ChargeRefundOutcome> {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { paymentIntentRef: facts.paymentIntentRef } });
    if (!order) return { result: "order_not_found" };

    // Số tiền đã hoàn chỉ tăng: sự kiện cũ đến muộn sau sự kiện mới không được kéo nó lùi.
    const refundedCents = Math.max(order.refundedCents ?? 0, Math.max(0, facts.refundedCents));
    if (refundedCents !== order.refundedCents) {
      await tx.order.update({ where: { id: order.id }, data: { refundedCents } });
    }

    if (order.status === "refunded") return { result: "already_refunded", orderId: order.id };
    if (order.status !== "paid") return { result: "not_paid", orderId: order.id };
    if (!facts.fullyRefunded) return { result: "partial", orderId: order.id };

    // Điều kiện `status: "paid"` trong updateMany là chốt chống đua: hai lần gửi cùng lúc, chỉ một cái count=1.
    const flipped = await tx.order.updateMany({
      where: { id: order.id, status: "paid" },
      data: { status: "refunded", refundedAt: new Date() },
    });
    if (flipped.count === 0) return { result: "already_refunded", orderId: order.id };

    // Còn lý do khác để giữ quyền thì chỉ đơn này đổi trạng thái: (a) một đơn paid khác cho cùng khoá, hoặc
    // (b) một mã kích hoạt học viên đã dùng cho khoá này.
    const [otherPaid, redeemedCode] = await Promise.all([
      tx.order.findFirst({
        where: { userId: order.userId, courseId: order.courseId, status: "paid", id: { not: order.id } },
        select: { id: true },
      }),
      tx.courseAccessCode.findFirst({
        where: { courseId: order.courseId, redeemedByUserId: order.userId, status: "redeemed" },
        select: { id: true },
      }),
    ]);
    if (otherPaid || redeemedCode) return { result: "refunded", orderId: order.id, enrollmentRevoked: false };

    const enrollment = await tx.enrollment.findUnique({
      where: { userId_courseId: { userId: order.userId, courseId: order.courseId } },
      select: { id: true, status: true },
    });
    if (!enrollment || enrollment.status === "refunded") {
      return { result: "refunded", orderId: order.id, enrollmentRevoked: false };
    }
    // Chỉ đóng quyền; tiến độ, bài nộp và LearningEvent giữ nguyên. Mua lại thì extendEnrollmentAccess mở lại.
    await tx.enrollment.update({ where: { id: enrollment.id }, data: { status: "refunded" } });
    await emitEvent(
      order.userId,
      LearningEventType.EnrollmentRefunded,
      { enrollmentId: enrollment.id, courseId: order.courseId, orderId: order.id },
      { courseId: order.courseId, eventKey: `enrollment.refunded:${order.id}` },
      tx as typeof prisma,
    );
    return { result: "refunded", orderId: order.id, enrollmentRevoked: true };
  });
}
