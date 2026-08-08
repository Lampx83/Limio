import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { enrollBySectionCode, EnrollError } from "@feedbackme/core-lms";
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
  { params }: { params: { code: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const section = await prisma.courseSection.findUnique({
    where: { inviteCode: params.code },
    select: { isDefault: true, course: { select: { slug: true } } },
  });
  if (!section || section.isDefault) {
    return NextResponse.json({ error: "invalid_invite_code" }, { status: 404 });
  }

  const paymentEnabled = await getPaymentEnabled();

  try {
    const result = await enrollBySectionCode(userId, params.code, undefined, {
      skipPaymentCheck: !paymentEnabled,
      baseUrl: getBaseUrl(req),
    });
    return NextResponse.json({
      ok: true,
      created: result.created,
      courseSlug: section.course.slug,
    });
  } catch (err) {
    if (err instanceof EnrollError) {
      if (err.code === "payment_required") {
        return NextResponse.json({ error: "payment_required" }, { status: 402 });
      }
      if (err.code === "course_not_enrollable") {
        return NextResponse.json({ error: "course_not_enrollable" }, { status: 409 });
      }
      if (err.code === "invalid_invite_code") {
        return NextResponse.json({ error: "invalid_invite_code" }, { status: 404 });
      }
    }
    throw err;
  }
}
