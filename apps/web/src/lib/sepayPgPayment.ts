import { Prisma, prisma } from "@feedbackme/db";
import { generatePaymentCode } from "@feedbackme/core-lms";
import { buildSepayPgCheckout, getSepayPgConfig, type SepayPgField } from "@/lib/sepayPg";

export type SepayPgPaymentErrorCode =
  | "sepay_pg_not_configured"
  | "course_not_enrollable"
  | "course_is_free"
  | "access_plan_not_found"
  | "currency_not_supported"
  | "bundle_not_found"
  | "bundle_not_purchasable"
  | "validation_failed";

export class SepayPgPaymentError extends Error {
  constructor(public readonly code: SepayPgPaymentErrorCode) {
    super(code);
  }
}

export interface CreateSepayPgPaymentInput {
  userId: string;
  courseId?: string;
  accessPlanId?: string;
  bundleId?: string;
  /** Gốc địa chỉ site (https://limio.vn) để dựng địa chỉ quay về. */
  origin: string;
}

/**
 * Tạo đơn `pending` và form khởi tạo thanh toán SePay đã ký (docs/tieu-chi/thanh-toan-sepay-pg.md, AC2). Mỗi lần gọi là một
 * đơn mới với mã hoá đơn mới (SePay đòi mã duy nhất). Quyền học chỉ do IPN cấp, không bao giờ ở đây hay ở trang quay về.
 */
export async function createSepayPgPayment(
  input: CreateSepayPgPaymentInput,
): Promise<{ orderId: string; url: string; fields: SepayPgField[] }> {
  const cfg = await getSepayPgConfig();
  if (!cfg) throw new SepayPgPaymentError("sepay_pg_not_configured");

  let target: { courseId: string | null; bundleId: string | null; accessPlanId: string | null };
  let amountCents: number;
  let currency: string;
  let label: string;

  if (input.bundleId) {
    const bundle = await prisma.courseBundle.findUnique({
      where: { id: input.bundleId },
      select: { id: true, slug: true, status: true, priceCents: true, currency: true, items: { select: { course: { select: { status: true } } } } },
    });
    if (!bundle) throw new SepayPgPaymentError("bundle_not_found");
    if (bundle.status !== "published" || bundle.items.length < 2 || bundle.items.some((i) => i.course.status !== "published")) {
      throw new SepayPgPaymentError("bundle_not_purchasable");
    }
    target = { courseId: null, bundleId: bundle.id, accessPlanId: null };
    amountCents = bundle.priceCents;
    currency = bundle.currency;
    label = `combo ${bundle.slug}`;
  } else if (input.courseId) {
    const course = await prisma.course.findUnique({
      where: { id: input.courseId },
      select: { id: true, slug: true, status: true, priceCents: true, currency: true },
    });
    if (!course || course.status !== "published") throw new SepayPgPaymentError("course_not_enrollable");
    label = `khoa hoc ${course.slug}`;
    if (input.accessPlanId) {
      const plan = await prisma.courseAccessPlan.findUnique({ where: { id: input.accessPlanId } });
      if (!plan || plan.courseId !== course.id || !plan.isActive) throw new SepayPgPaymentError("access_plan_not_found");
      amountCents = plan.priceCents;
      currency = plan.currency;
      target = { courseId: course.id, bundleId: null, accessPlanId: plan.id };
    } else {
      if (!course.priceCents || course.priceCents <= 0) throw new SepayPgPaymentError("course_is_free");
      amountCents = course.priceCents;
      currency = course.currency;
      target = { courseId: course.id, bundleId: null, accessPlanId: null };
    }
  } else {
    throw new SepayPgPaymentError("validation_failed");
  }
  if (currency.toUpperCase() !== "VND" || !Number.isInteger(amountCents) || amountCents <= 0) {
    throw new SepayPgPaymentError("currency_not_supported");
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const invoice = generatePaymentCode(); // LM + 10 ký tự: duy nhất, ngắn, không dấu
    try {
      const order = await prisma.order.create({
        data: {
          userId: input.userId,
          courseId: target.courseId,
          bundleId: target.bundleId,
          accessPlanId: target.accessPlanId,
          amountCents,
          currency: "VND",
          provider: "sepay_pg",
          status: "pending",
          providerRef: invoice,
        },
        select: { id: true },
      });
      const ret = (status: string) => `${input.origin}/api/payments/sepaypg/return?order=${order.id}&status=${status}`;
      const checkout = buildSepayPgCheckout(cfg, {
        invoiceNumber: invoice,
        amount: amountCents,
        description: `Thanh toan ${label}`,
        successUrl: ret("success"),
        errorUrl: ret("error"),
        cancelUrl: ret("cancel"),
      });
      return { orderId: order.id, ...checkout };
    } catch (e) {
      if (attempt < 4 && e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
  throw new SepayPgPaymentError("validation_failed");
}
