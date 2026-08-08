import Stripe from "stripe";
import { prisma } from "@feedbackme/db";
import { getIntegrationSecret, resolveDefaultSectionId } from "@feedbackme/core-lms";

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
  if (!course.priceCents || course.priceCents <= 0) {
    throw new Error("course_is_free");
  }

  // Reuse pending order if one exists for the same (user, course) — avoids
  // duplicate Stripe sessions when the user clicks twice.
  const existing = await prisma.order.findFirst({
    where: {
      userId: input.userId,
      courseId: input.courseId,
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
          currency: course.currency.toLowerCase(),
          product_data: {
            name: course.title,
            description: course.description.slice(0, 200),
          },
          unit_amount: course.priceCents,
        },
        quantity: 1,
      },
    ],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    metadata: { courseId: course.id, userId: input.userId },
  });

  const order = await prisma.order.create({
    data: {
      userId: input.userId,
      courseId: course.id,
      amountCents: course.priceCents,
      currency: course.currency,
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
      // Auto-enroll on payment. Look up current course version.
      const course = await tx.course.findUniqueOrThrow({
        where: { id: order.courseId },
        select: { version: true },
      });
      const sectionId = await resolveDefaultSectionId(order.courseId, tx as typeof prisma);
      await tx.enrollment.upsert({
        where: {
          userId_courseId: { userId: order.userId, courseId: order.courseId },
        },
        create: {
          userId: order.userId,
          courseId: order.courseId,
          sectionId,
          courseVersion: course.version,
        },
        update: {},
      });
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
