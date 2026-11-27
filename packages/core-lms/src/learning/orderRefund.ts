import { prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { emitEvent } from "./events";
import { logAudit } from "../auth/audit";
import { assertCanManageCourseSales } from "../courses/salesAccess";

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
  /** Đơn combo (không gắn một khoá): combo chỉ có VNPay, hoàn tiền làm tay — bỏ qua an toàn. */
  | { result: "unsupported_order"; orderId: string }
  /** Hoàn toàn bộ. `enrollmentRevoked=false` khi học viên còn lý do khác để giữ quyền (hoặc không có ghi danh). */
  | { result: "refunded"; orderId: string; enrollmentRevoked: boolean };

export async function processChargeRefund(
  facts: ChargeRefundFacts,
  db: PrismaClient = prisma,
): Promise<ChargeRefundOutcome> {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { paymentIntentRef: facts.paymentIntentRef } });
    if (!order) return { result: "order_not_found" };
    if (!order.courseId) return { result: "unsupported_order", orderId: order.id };

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

    const enrollmentRevoked = await revokeAfterFullRefund(tx, order);
    return { result: "refunded", orderId: order.id, enrollmentRevoked };
  });
}

type RefundTx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/**
 * Đóng quyền học sau khi đơn đã được hoàn toàn bộ (dùng chung cho webhook Stripe và hoàn tay của nhà xuất bản).
 * Còn lý do khác để giữ quyền thì chỉ đơn đổi trạng thái: (a) một đơn paid khác cho cùng khoá, hoặc (b) một mã kích hoạt
 * học viên đã dùng cho khoá này. Trả true nếu quyền học vừa bị đóng.
 */
async function revokeAfterFullRefund(
  tx: RefundTx,
  order: { id: string; userId: string; courseId: string | null },
): Promise<boolean> {
  const orderCourseId = order.courseId;
  if (!orderCourseId) return false;
  const [otherPaid, redeemedCode] = await Promise.all([
    tx.order.findFirst({
      where: { userId: order.userId, courseId: orderCourseId, status: "paid", id: { not: order.id } },
      select: { id: true },
    }),
    tx.courseAccessCode.findFirst({
      where: { courseId: orderCourseId, redeemedByUserId: order.userId, status: "redeemed" },
      select: { id: true },
    }),
  ]);
  if (otherPaid || redeemedCode) return false;

  const enrollment = await tx.enrollment.findUnique({
    where: { userId_courseId: { userId: order.userId, courseId: orderCourseId } },
    select: { id: true, status: true },
  });
  if (!enrollment || enrollment.status === "refunded") return false;
  // Chỉ đóng quyền; tiến độ, bài nộp và LearningEvent giữ nguyên. Mua lại thì extendEnrollmentAccess mở lại.
  await tx.enrollment.update({ where: { id: enrollment.id }, data: { status: "refunded" } });
  await emitEvent(
    order.userId,
    LearningEventType.EnrollmentRefunded,
    { enrollmentId: enrollment.id, courseId: orderCourseId, orderId: order.id },
    { courseId: orderCourseId, eventKey: `enrollment.refunded:${order.id}` },
    tx as typeof prisma,
  );
  return true;
}

// ---------------------------------------------------------------------------------------------------------------
// Khu nhà xuất bản: danh sách đơn ẩn danh và hoàn tay (docs/tieu-chi/khu-nha-xuat-ban.md)
// ---------------------------------------------------------------------------------------------------------------

export class OrderRefundError extends Error {
  constructor(public readonly code: "forbidden" | "order_not_found" | "not_paid" | "unsupported_order") {
    super(code);
  }
}

/**
 * Mã đơn người mua đọc được, KHỚP với mã trong email xác nhận mua (`purchaseEmail`): mã của cổng thanh toán nếu có, không thì 8 ký tự đầu
 * của id, in hoa. Quản trị nhà xuất bản tìm đơn bằng mã này, không bằng tên hay email.
 */
export function orderPublicCode(order: { id: string; providerRef?: string | null }): string {
  return order.providerRef ?? order.id.slice(0, 8).toUpperCase();
}

export interface PublisherOrderRow {
  id: string;
  code: string;
  courseId: string;
  courseTitle: string;
  amountCents: number;
  currency: string;
  provider: string;
  status: "paid" | "refunded";
  paidAt: Date | null;
  refundedAt: Date | null;
  refundedCents: number | null;
}

/**
 * Đơn của một khoá để nhà xuất bản đối chiếu và hoàn tiền. KHÔNG trả danh tính người mua (tên, email, id người dùng): quản trị nhà xuất bản
 * thấy số liệu bán hàng chứ không thấy học viên. Chỉ đơn đã trả tiền hoặc đã hoàn. Người gọi phải quản lý bán hàng của khoá.
 */
export async function listPublisherOrders(
  userId: string,
  courseId: string,
  opts: { code?: string; status?: "paid" | "refunded"; take?: number } = {},
  db: PrismaClient = prisma,
): Promise<PublisherOrderRow[]> {
  await assertCanManageCourseSales(userId, courseId, db);
  const code = opts.code?.trim() ?? "";
  const rows = await db.order.findMany({
    where: {
      courseId,
      status: opts.status ?? { in: ["paid", "refunded"] },
      // Khớp mã cổng thanh toán (không phân biệt hoa thường) hoặc 8 ký tự đầu của id, đúng hai dạng `orderPublicCode` trả.
      ...(code
        ? { OR: [{ providerRef: { equals: code, mode: "insensitive" as const } }, { id: { startsWith: code.toLowerCase() } }] }
        : {}),
    },
    select: {
      id: true,
      providerRef: true,
      courseId: true,
      amountCents: true,
      currency: true,
      provider: true,
      status: true,
      paidAt: true,
      refundedAt: true,
      refundedCents: true,
      course: { select: { title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(opts.take ?? 100, 1), 200),
  });
  return rows.map((o) => ({
    id: o.id,
    code: orderPublicCode(o),
    courseId: o.courseId!,
    courseTitle: o.course?.title ?? "",
    amountCents: o.amountCents,
    currency: o.currency,
    provider: o.provider,
    status: o.status as "paid" | "refunded",
    paidAt: o.paidAt,
    refundedAt: o.refundedAt,
    refundedCents: o.refundedCents,
  }));
}

/**
 * Nhà xuất bản xác nhận ĐÃ hoàn tiền cho một đơn (ngoài hệ thống, qua cổng thanh toán hay chuyển khoản): đơn → refunded,
 * quyền học đóng theo đúng luật của webhook hoàn tiền. Hệ thống KHÔNG chuyển tiền. Idempotent; ghi nhật ký người thao tác.
 */
export async function refundOrderByPublisher(
  actorUserId: string,
  orderId: string,
  db: PrismaClient = prisma,
): Promise<{ orderId: string; alreadyRefunded: boolean; enrollmentRevoked: boolean }> {
  const found = await db.order.findUnique({ where: { id: orderId }, select: { courseId: true } });
  if (!found) throw new OrderRefundError("order_not_found");
  // Combo (không gắn một khoá) hoàn tay riêng, như đường Stripe.
  if (!found.courseId) throw new OrderRefundError("unsupported_order");
  const courseId = found.courseId;
  try {
    await assertCanManageCourseSales(actorUserId, courseId, db);
  } catch {
    // Không lộ đơn của khoá người khác: không quyền thì cũng báo như không có.
    throw new OrderRefundError("order_not_found");
  }
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    if (order.status === "refunded") return { orderId, alreadyRefunded: true, enrollmentRevoked: false };
    if (order.status !== "paid") throw new OrderRefundError("not_paid");
    // `status: "paid"` trong where là chốt chống đua hai lần bấm cùng lúc.
    const flipped = await tx.order.updateMany({
      where: { id: orderId, status: "paid" },
      data: { status: "refunded", refundedAt: new Date(), refundedCents: order.amountCents },
    });
    if (flipped.count === 0) return { orderId, alreadyRefunded: true, enrollmentRevoked: false };
    const enrollmentRevoked = await revokeAfterFullRefund(tx, order);
    await logAudit(
      { action: "order.refunded_by_publisher", actorUserId, targetUserId: null, payload: { orderId, courseId, enrollmentRevoked } },
      tx as typeof prisma,
    );
    return { orderId, alreadyRefunded: false, enrollmentRevoked };
  });
}

/** Khoá của một đơn (null nếu không có đơn hoặc là đơn combo): cho route đối chiếu đơn với khoá trong đường dẫn. */
export async function getOrderCourseId(orderId: string, db: PrismaClient = prisma): Promise<string | null> {
  const o = await db.order.findUnique({ where: { id: orderId }, select: { courseId: true } });
  return o?.courseId ?? null;
}
