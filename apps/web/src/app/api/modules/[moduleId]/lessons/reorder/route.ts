import { NextResponse } from "next/server";
import { CourseAuthzError, CourseError, reorderLessons } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: { moduleId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as { orderedLessonIds?: string[] } | null;
  if (!body?.orderedLessonIds || !Array.isArray(body.orderedLessonIds)) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  try {
    await reorderLessons(userId, params.moduleId, body.orderedLessonIds);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof CourseError || e instanceof CourseAuthzError) {
      return NextResponse.json({ error: e.code }, { status: 400 });
    }
    throw e;
  }
}
