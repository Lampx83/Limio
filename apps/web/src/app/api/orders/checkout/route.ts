import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";
import { createCheckoutSession } from "@/lib/payments";

export const runtime = "nodejs";

/**
 * Create a Stripe Checkout Session for a paid course.
 * Body: { courseId }
 */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as { courseId?: string } | null;
  if (!body?.courseId) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  const course = await prisma.course.findUnique({
    where: { id: body.courseId },
    select: { slug: true, status: true, priceCents: true },
  });
  if (!course) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (course.status !== "published") {
    return NextResponse.json({ error: "course_not_enrollable" }, { status: 400 });
  }
  if (!course.priceCents || course.priceCents <= 0) {
    return NextResponse.json({ error: "course_is_free" }, { status: 400 });
  }

  const origin = new URL(req.url).origin;
  try {
    const r = await createCheckoutSession({
      userId,
      courseId: body.courseId,
      successUrl: `${origin}/learn/${course.slug}?paid=1`,
      cancelUrl: `${origin}/catalog/${course.slug}?cancelled=1`,
    });
    return NextResponse.json(r);
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "stripe_not_configured") {
      return NextResponse.json(
        { error: "stripe_not_configured" },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "checkout_failed", details: msg }, { status: 500 });
  }
}
