import { Prisma } from "@feedbackme/db";
import { prisma } from "@feedbackme/db";
import { generatePaymentCode } from "@feedbackme/core-lms";
import { buildSepayQrUrl, getSepayConfig } from "@/lib/sepay";

export type SepayPaymentErrorCode =
  | "sepay_not_configured"
  | "course_not_enrollable"
  | "course_is_free"
  | "access_plan_not_found"
  | "currency_not_supported"
  | "bundle_not_found"
  | "bundle_not_purchasable"
  | "validation_failed";

export class SepayPaymentError extends Error {
  constructor(public readonly code: SepayPaymentErrorCode) {
    super(code);
  }
}

export interface BankTransferInfo {
  orderId: string;
  /** Mã thanh toán = nội dung chuyển khoản. */
  code: string;
  amountCents: number;
  currency: "VND";
  bank: string;
  accountNumber: string;
  accountHolder: string;
  qrUrl: string;
}

export interface CreateSepayPaymentInput {
  userId: string;
  courseId?: string;
  accessPlanId?: string;
  bundleId?: string;
}

/** Đơn chuyển khoản còn dùng lại được trong chừng này giờ (cùng người, cùng gói/combo, cùng số tiền). */
const REUSE_HOURS = 24;

/**
 * Tạo đơn chuyển khoản `pending` và trả thông tin để hiện QR (docs/tieu-chi/thanh-toan-sepay.md, AC2). Quyền học chỉ do
 * webhook cấp (processBankTransaction), không bao giờ ở đây.
 */
export async function createSepayPayment(input: CreateSepayPaymentInput): Promise<BankTransferInfo> {
  const cfg = await getSepayConfig();
  if (!cfg) throw new SepayPaymentError("sepay_not_configured");

  let target: { courseId: string | null; bundleId: string | null; accessPlanId: string | null };
  let amountCents: number;
  let currency: string;

  if (input.bundleId) {
    const bundle = await prisma.courseBundle.findUnique({
      where: { id: input.bundleId },
      select: { id: true, status: true, priceCents: true, currency: true, items: { select: { course: { select: { status: true } } } } },
    });
    if (!bundle) throw new SepayPaymentError("bundle_not_found");
    if (bundle.status !== "published" || bundle.items.length < 2 || bundle.items.some((i) => i.course.status !== "published")) {
      throw new SepayPaymentError("bundle_not_purchasable");
    }
    target = { courseId: null, bundleId: bundle.id, accessPlanId: null };
    amountCents = bundle.priceCents;
    currency = bundle.currency;
  } else if (input.courseId) {
    const course = await prisma.course.findUnique({
      where: { id: input.courseId },
      select: { id: true, status: true, priceCents: true, currency: true },
    });
    if (!course) throw new SepayPaymentError("course_not_enrollable");
    if (course.status !== "published") throw new SepayPaymentError("course_not_enrollable");
    if (input.accessPlanId) {
      const plan = await prisma.courseAccessPlan.findUnique({ where: { id: input.accessPlanId } });
      if (!plan || plan.courseId !== course.id || !plan.isActive) throw new SepayPaymentError("access_plan_not_found");
      amountCents = plan.priceCents;
      currency = plan.currency;
      target = { courseId: course.id, bundleId: null, accessPlanId: plan.id };
    } else {
      if (!course.priceCents || course.priceCents <= 0) throw new SepayPaymentError("course_is_free");
      amountCents = course.priceCents;
      currency = course.currency;
      target = { courseId: course.id, bundleId: null, accessPlanId: null };
    }
  } else {
    throw new SepayPaymentError("validation_failed");
  }
  if (currency.toUpperCase() !== "VND" || !Number.isInteger(amountCents) || amountCents <= 0) {
    throw new SepayPaymentError("currency_not_supported");
  }

  const info = (orderId: string, code: string): BankTransferInfo => ({
    orderId,
    code,
    amountCents,
    currency: "VND",
    bank: cfg.bank,
    accountNumber: cfg.accountNumber,
    accountHolder: cfg.accountHolder,
    qrUrl: buildSepayQrUrl(cfg, amountCents, code),
  });

  const existing = await prisma.order.findFirst({
    where: {
      userId: input.userId,
      provider: "sepay",
      status: "pending",
      amountCents,
      courseId: target.courseId,
      bundleId: target.bundleId,
      accessPlanId: target.accessPlanId,
      createdAt: { gt: new Date(Date.now() - REUSE_HOURS * 3600_000) },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, providerRef: true },
  });
  if (existing?.providerRef) return info(existing.id, existing.providerRef);

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generatePaymentCode();
    try {
      const order = await prisma.order.create({
        data: {
          userId: input.userId,
          courseId: target.courseId,
          bundleId: target.bundleId,
          accessPlanId: target.accessPlanId,
          amountCents,
          currency: "VND",
          provider: "sepay",
          status: "pending",
          providerRef: code,
        },
        select: { id: true },
      });
      return info(order.id, code);
    } catch (e) {
      if (attempt < 4 && e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
  throw new SepayPaymentError("validation_failed");
}
