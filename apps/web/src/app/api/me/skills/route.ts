import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { getLearnerSkillStates } from "@feedbackme/core-feedback";
import { requireUserId } from "@/lib/session";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const courseParam = url.searchParams.get("courseId") ?? url.searchParams.get("courseSlug");
  let courseId: string | undefined;
  if (courseParam) {
    if (UUID_RE.test(courseParam)) {
      courseId = courseParam;
    } else {
      const c = await prisma.course.findUnique({
        where: { slug: courseParam },
        select: { id: true },
      });
      if (!c) return NextResponse.json({ error: "not_found" }, { status: 404 });
      courseId = c.id;
    }
  }

  const skills = await getLearnerSkillStates(userId, courseId);
  return NextResponse.json({ items: skills });
}
