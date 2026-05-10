import { NextResponse } from "next/server";
import { CourseAuthzError, CourseError, deleteCourse } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Accept either course id (uuid) or slug.
  const course = await prisma.course.findFirst({
    where: { OR: [{ id: params.id }, { slug: params.id }] },
    select: { id: true },
  });
  if (!course) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    confirmTitle?: unknown;
    force?: unknown;
  };
  const confirmTitle =
    typeof body.confirmTitle === "string" ? body.confirmTitle : "";
  const force = body.force === true;

  try {
    const r = await deleteCourse(userId, course.id, confirmTitle, { force });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    if (e instanceof CourseAuthzError) {
      return NextResponse.json(
        { error: e.code },
        { status: e.code === "not_found" ? 404 : 403 },
      );
    }
    if (e instanceof CourseError) {
      const status =
        e.code === "has_enrollments" ? 409 : e.code === "title_mismatch" ? 400 : 400;
      return NextResponse.json({ error: e.code, details: e.details }, { status });
    }
    throw e;
  }
}
