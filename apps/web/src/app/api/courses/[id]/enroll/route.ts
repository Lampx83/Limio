import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { enrollInCourse, EnrollError } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { getPaymentEnabled } from "@/lib/site-settings";

export const runtime = "nodejs";

function getBaseUrl(req: Request): string {
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : "";
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // `id` may be a slug (called from catalog) or a UUID — support both.
  const course = await prisma.course.findFirst({
    where: { OR: [{ slug: params.id }, { id: params.id }] },
    select: { id: true, priceCents: true, currency: true },
  });
  if (!course) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const paymentEnabled = await getPaymentEnabled();

  try {
    const result = await enrollInCourse(userId, course.id, undefined, {
      skipPaymentCheck: !paymentEnabled,
      baseUrl: getBaseUrl(req),
    });
    return NextResponse.json({ ok: true, created: result.created });
  } catch (err) {
    if (err instanceof EnrollError) {
      if (err.code === "payment_required") {
        return NextResponse.json(
          { error: "payment_required", priceCents: course.priceCents, currency: course.currency },
          { status: 402 },
        );
      }
      if (err.code === "course_not_enrollable") {
        return NextResponse.json({ error: "course_not_enrollable" }, { status: 409 });
      }
      if (err.code === "course_not_found") {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
    }
    throw err;
  }
}
