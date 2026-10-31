import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";
import { createCheckoutSession } from "@/lib/payments";
import { VnpayPaymentError, createVnpayPayment } from "@/lib/vnpayPayment";
import { clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Tạo thanh toán cho khoá có phí.
 * Body: { courseId, accessPlanId?, provider?: "stripe" | "vnpay" } — bỏ trống provider = Stripe (như trước).
 */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as { courseId?: string; accessPlanId?: string; provider?: string } | null;
  if (!body?.courseId || (body.provider !== undefined && body.provider !== "stripe" && body.provider !== "vnpay")) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  if (body.provider === "vnpay") {
    const origin = new URL(req.url).origin;
    try {
      const r = await createVnpayPayment({
        userId,
        courseId: body.courseId,
        accessPlanId: body.accessPlanId,
        ipAddr: clientIp(req) === "unknown" ? "127.0.0.1" : clientIp(req),
        returnUrl: `${origin}/api/payments/vnpay/return`,
      });
      return NextResponse.json(r);
    } catch (e) {
      if (e instanceof VnpayPaymentError) {
        return NextResponse.json({ error: e.code }, { status: e.code === "vnpay_not_configured" ? 503 : 400 });
      }
      // Khoá không tồn tại (findUniqueOrThrow) và mọi lỗi khác: không lộ chi tiết.
      const notFound = (e as { code?: string }).code === "P2025";
      return NextResponse.json({ error: notFound ? "not_found" : "checkout_failed" }, { status: notFound ? 404 : 500 });
    }
  }
  const course = await prisma.course.findUnique({
    where: { id: body.courseId },
    select: { slug: true, status: true, priceCents: true },
  });
  if (!course) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (course.status !== "published") {
    return NextResponse.json({ error: "course_not_enrollable" }, { status: 400 });
  }
  if (!body.accessPlanId && (!course.priceCents || course.priceCents <= 0)) {
    return NextResponse.json({ error: "course_is_free" }, { status: 400 });
  }

  const origin = new URL(req.url).origin;
  try {
    const r = await createCheckoutSession({
      userId,
      courseId: body.courseId,
      accessPlanId: body.accessPlanId,
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
    if (msg === "access_plan_not_found") {
      return NextResponse.json({ error: "access_plan_not_found" }, { status: 400 });
    }
    return NextResponse.json({ error: "checkout_failed", details: msg }, { status: 500 });
  }
}
