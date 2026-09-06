import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { enrollBySectionCode, switchSectionByCode, EnrollError } from "@feedbackme/core-lms";
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

  // Trang mời viết hoa mã trước khi tra, còn ở đây thì không — nên một mã gõ
  // tay bằng chữ thường vào thẳng API sẽ không tìm thấy lớp nào.
  const code = params.code.trim().toUpperCase();

  const section = await prisma.courseSection.findUnique({
    where: { inviteCode: code },
    select: { isDefault: true, course: { select: { slug: true } } },
  });
  if (!section || section.isDefault) {
    return NextResponse.json({ error: "invalid_invite_code" }, { status: 404 });
  }

  // Người đã ghi danh khoá này bằng đường khác thì đây là chuyển lớp, không
  // phải ghi danh mới — và phải do họ bấm xác nhận riêng, xem
  // `switchSectionByCode`.
  const body = await req.json().catch(() => ({}));
  if (body?.move === true) {
    try {
      const moved = await switchSectionByCode(userId, code);
      return NextResponse.json({ ok: true, moved: true, courseSlug: moved.courseSlug });
    } catch (err) {
      if (err instanceof EnrollError) {
        const status = err.code === "not_enrolled" ? 409 : 404;
        return NextResponse.json({ error: err.code }, { status });
      }
      throw err;
    }
  }

  const paymentEnabled = await getPaymentEnabled();

  try {
    const result = await enrollBySectionCode(userId, code, undefined, {
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
