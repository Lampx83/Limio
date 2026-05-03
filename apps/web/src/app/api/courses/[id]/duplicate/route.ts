import { NextResponse } from "next/server";
import { CourseAuthzError, duplicateCourse } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
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

  try {
    const r = await duplicateCourse(userId, course.id);
    return NextResponse.json(r, { status: 201 });
  } catch (e) {
    if (e instanceof CourseAuthzError) {
      return NextResponse.json(
        { error: e.code },
        { status: e.code === "not_found" ? 404 : 403 },
      );
    }
    throw e;
  }
}
