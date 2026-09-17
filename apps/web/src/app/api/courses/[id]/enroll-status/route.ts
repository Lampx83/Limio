import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { isUserEnrolled } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Polled by PaymentProcessingNotice right after a Stripe redirect back to
 * `/learn/[slug]?paid=1` — webhook processing can lag a few seconds behind
 * the browser redirect, so the learn page can't assume enrollment exists yet.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const course = await prisma.course.findFirst({
    where: { OR: [{ slug: params.id }, { id: params.id }] },
    select: { id: true },
  });
  if (!course) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const enrolled = await isUserEnrolled(userId, course.id);
  return NextResponse.json({ enrolled });
}
