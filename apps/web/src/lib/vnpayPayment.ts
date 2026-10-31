import { randomUUID } from "node:crypto";
import { prisma } from "@feedbackme/db";
import {
  VNPAY_EXPIRE_MINUTES,
  VNPAY_VERSION,
  buildVnpayPaymentUrl,
  formatVnpayDate,
  getVnpayConfig,
  vnpayOrderInfo,
} from "@/lib/vnpay";

/** Mã lỗi trả cho route; không bao giờ mang thông số kỹ thuật tới học viên. */
export type VnpayPaymentErrorCode =
  | "vnpay_not_configured"
  | "course_not_enrollable"
  | "course_is_free"
  | "access_plan_not_found"
  | "currency_not_supported";

export class VnpayPaymentError extends Error {
  constructor(public readonly code: VnpayPaymentErrorCode) {
    super(code);
  }
}

export interface CreateVnpayPaymentInput {
  userId: string;
  courseId: string;
  accessPlanId?: string;
  /** IP người mua (VNPay bắt buộc). */
  ipAddr: string;
  /** Địa chỉ tuyệt đối VNPay chuyển người mua về sau khi trả. */
  returnUrl: string;
}

/**
 * Tạo đơn `pending` và URL thanh toán VNPay đã ký (docs/tieu-chi/thanh-toan-vnpay.md, AC2). Chỉ tạo `Order` sau khi
 * mọi điều kiện đạt; mỗi lần gọi là một đơn mới với mã giao dịch mới (VNPay đòi mã không trùng trong ngày).
 */
export async function createVnpayPayment(input: CreateVnpayPaymentInput): Promise<{ orderId: string; url: string }> {
  const cfg = await getVnpayConfig();
  if (!cfg) throw new VnpayPaymentError("vnpay_not_configured");

  const course = await prisma.course.findUniqueOrThrow({
    where: { id: input.courseId },
    select: { id: true, slug: true, status: true, priceCents: true, currency: true },
  });
  if (course.status !== "published") throw new VnpayPaymentError("course_not_enrollable");

  let amountCents: number;
  let currency: string;
  if (input.accessPlanId) {
    const plan = await prisma.courseAccessPlan.findUnique({ where: { id: input.accessPlanId } });
    if (!plan || plan.courseId !== course.id || !plan.isActive) throw new VnpayPaymentError("access_plan_not_found");
    amountCents = plan.priceCents;
    currency = plan.currency;
  } else {
    if (!course.priceCents || course.priceCents <= 0) throw new VnpayPaymentError("course_is_free");
    amountCents = course.priceCents;
    currency = course.currency;
  }
  // VNPay chỉ nhận VND; số đồng nguyên dương (VND không có phần lẻ).
  if (currency.toUpperCase() !== "VND" || !Number.isInteger(amountCents) || amountCents <= 0) {
    throw new VnpayPaymentError("currency_not_supported");
  }

  const orderId = randomUUID();
  const txnRef = orderId.replace(/-/g, "");
  await prisma.order.create({
    data: {
      id: orderId,
      userId: input.userId,
      courseId: course.id,
      accessPlanId: input.accessPlanId ?? null,
      amountCents,
      currency: "VND",
      provider: "vnpay",
      status: "pending",
      providerRef: txnRef,
    },
  });

  const now = new Date();
  const url = buildVnpayPaymentUrl(
    cfg.paymentUrl,
    {
      vnp_Version: VNPAY_VERSION,
      vnp_Command: "pay",
      vnp_TmnCode: cfg.tmnCode,
      vnp_Amount: String(amountCents * 100),
      vnp_CurrCode: "VND",
      vnp_TxnRef: txnRef,
      vnp_OrderInfo: vnpayOrderInfo(`Thanh toan khoa hoc ${course.slug}`),
      vnp_OrderType: "other",
      vnp_Locale: "vn",
      vnp_ReturnUrl: input.returnUrl,
      vnp_IpAddr: input.ipAddr,
      vnp_CreateDate: formatVnpayDate(now),
      vnp_ExpireDate: formatVnpayDate(new Date(now.getTime() + VNPAY_EXPIRE_MINUTES * 60_000)),
    },
    cfg.hashSecret,
  );
  return { orderId, url };
}
