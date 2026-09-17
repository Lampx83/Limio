import Stripe from "stripe";
import { prisma } from "@feedbackme/db";
import { getIntegrationSecret, extendEnrollmentAccess } from "@feedbackme/core-lms";

/**
 * Resolve Stripe client. Uses encrypted IntegrationCredential if set,
 * else falls back to STRIPE_SECRET_KEY env var.
 */
async function getStripe(): Promise<Stripe> {
  let key: string;
  try {
    key = await getIntegrationSecret("stripe.secret");
  } catch {
    key = process.env.STRIPE_SECRET_KEY ?? "";
  }
  if (!key) throw new Error("stripe_not_configured");
  return new Stripe(key);
}

export interface CreateCheckoutInput {
  userId: string;
  courseId: string;
  /**
   * Gói truy cập có thời hạn đã chọn (CourseAccessPlan). Bỏ trống = đường cũ,
   * mua theo giá phẳng `Course.priceCents` (vĩnh viễn) — giữ nguyên hành vi
   * cho khoá học chưa có gói nào.
   */
  accessPlanId?: string;
  /** Where to redirect after success — typically `/learn/[slug]`. */
  successUrl: string;
  /** Where to redirect on cancel — typically the catalog page. */
  cancelUrl: string;
}

export async function createCheckoutSession(input: CreateCheckoutInput) {
  const course = await prisma.course.findUniqueOrThrow({
    where: { id: input.courseId },
    select: {
      id: true,
      title: true,
      description: true,
      priceCents: true,
      currency: true,
      slug: true,
    },
  });

  let amountCents: number;
  let currency: string;
  let planLabel: string | null = null;
  if (input.accessPlanId) {
    const plan = await prisma.courseAccessPlan.findUniqueOrThrow({
      where: { id: input.accessPlanId },
    });
    if (plan.courseId !== course.id || !plan.isActive) {
      throw new Error("access_plan_not_found");
    }
    amountCents = plan.priceCents;
    currency = plan.currency;
    planLabel = plan.label;
  } else {
    if (!course.priceCents || course.priceCents <= 0) {
      throw new Error("course_is_free");
    }
    amountCents = course.priceCents;
    currency = course.currency;
  }

  // Reuse pending order if one exists for the same (user, course, plan) —
  // avoids duplicate Stripe sessions when the user clicks twice.
  const existing = await prisma.order.findFirst({
    where: {
      userId: input.userId,
      courseId: input.courseId,
      accessPlanId: input.accessPlanId ?? null,
      status: "pending",
    },
  });
  if (existing && existing.providerRef) {
    const stripe = await getStripe();
    const sess = await stripe.checkout.sessions.retrieve(existing.providerRef);
    if (sess.url && (sess.status === "open")) {
      return { orderId: existing.id, url: sess.url };
    }
  }

  const stripe = await getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: currency.toLowerCase(),
          product_data: {
            name: planLabel ? `${course.title} — ${planLabel}` : course.title,
            description: course.description.slice(0, 200),
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    metadata: { courseId: course.id, userId: input.userId, accessPlanId: input.accessPlanId ?? "" },
  });

  const order = await prisma.order.create({
    data: {
      userId: input.userId,
      courseId: course.id,
      accessPlanId: input.accessPlanId,
      amountCents,
      currency,
      provider: "stripe",
      status: "pending",
      providerRef: session.id,
    },
  });

  return { orderId: order.id, url: session.url ?? "" };
}

/**
 * Process a verified Stripe webhook event. Caller must have already
 * verified the signature.
 */
export async function processStripeWebhook(event: Stripe.Event) {
  if (event.type === "checkout.session.completed") {
    const sess = event.data.object as Stripe.Checkout.Session;
    const order = await prisma.order.findFirst({
      where: { providerRef: sess.id },
    });
    if (!order || order.status === "paid") return;
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: { status: "paid", paidAt: new Date() },
      });
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
      // Cấp/gia hạn quyền truy cập — null durationMonths = vĩnh viễn, đúng
      // hành vi cũ cho Order không gắn CourseAccessPlan.
      await extendEnrollmentAccess(order.userId, course, plan, tx as typeof prisma);
    });
  } else if (event.type === "checkout.session.expired") {
    const sess = event.data.object as Stripe.Checkout.Session;
    await prisma.order.updateMany({
      where: { providerRef: sess.id, status: "pending" },
      data: { status: "failed" },
    });
  }
}

export { getStripe };
