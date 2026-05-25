import { NextResponse } from "next/server";
import {
  CourseAuthzError,
  CourseError,
  reorderLessonActivities,
} from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/**
 * Reorder all activities (content + quiz + assignment) within a lesson.
 * Body: `{ orderedActivityIds: string[] }` — must include every LessonActivity
 * row currently attached to the lesson.
 */
export async function POST(
  req: Request,
  { params }: { params: { lessonId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as { orderedActivityIds?: string[] } | null;
  if (!body?.orderedActivityIds || !Array.isArray(body.orderedActivityIds)) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  try {
    await reorderLessonActivities(userId, params.lessonId, body.orderedActivityIds);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof CourseError || e instanceof CourseAuthzError) {
      return NextResponse.json({ error: e.code }, { status: 400 });
    }
    throw e;
  }
}
