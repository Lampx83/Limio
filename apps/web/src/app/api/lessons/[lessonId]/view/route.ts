import { NextResponse } from "next/server";
import { trackLessonView } from "@feedbackme/core-lms";
import { onLessonViewed } from "@feedbackme/core-gamification";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export async function POST(
  req: Request,
  { params }: { params: { lessonId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  try {
    const { courseId } = await trackLessonView(userId, params.lessonId, body);
    const { streak } = await onLessonViewed({ userId, courseId });
    return NextResponse.json({ ok: true, streak });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
