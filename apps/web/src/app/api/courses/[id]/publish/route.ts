import { NextResponse } from "next/server";
import { CourseAuthzError, CourseError, publishCourse } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Accept either uuid or slug.
  const course = await prisma.course.findFirst({
    where: { OR: [{ id: params.id }, { slug: params.id }] },
    select: { id: true },
  });
  if (!course) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    await publishCourse(userId, course.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof CourseAuthzError) {
      return NextResponse.json(
        { error: e.code },
        { status: e.code === "not_found" ? 404 : 403 },
      );
    }
    if (e instanceof CourseError) {
      const status = e.code === "lessons_missing_skills" ? 409 : 400;
      return NextResponse.json(
        { error: e.code, details: e.details },
        { status },
      );
    }
    throw e;
  }
}
