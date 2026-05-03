import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { getCourseXpProgress } from "@feedbackme/core-gamification";
import { requireUserId } from "@/lib/session";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _req: Request,
  { params }: { params: { idOrSlug: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const courseId = UUID_RE.test(params.idOrSlug)
    ? params.idOrSlug
    : (await prisma.course.findUnique({
        where: { slug: params.idOrSlug },
        select: { id: true },
      }))?.id;
  if (!courseId) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const progress = await getCourseXpProgress(userId, courseId);
  return NextResponse.json(progress);
}
