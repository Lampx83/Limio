import { NextResponse } from "next/server";
import { z } from "zod";
import { completeLesson, type LessonCompleteReason } from "@feedbackme/core-lms";
import {
  onCourseCompleted,
  onLessonCompleted,
} from "@feedbackme/core-gamification";
import { recordPathSuggestion } from "@feedbackme/core-feedback";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

const Body = z.object({
  reason: z.enum(["marked_complete", "watched_threshold", "skipped"]).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: { lessonId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Body is optional; default reason = marked_complete to preserve old behavior.
  const raw = await readJson(req);
  const parsed = Body.safeParse(raw ?? {});
  const reason: LessonCompleteReason = parsed.success
    ? (parsed.data.reason ?? "marked_complete")
    : "marked_complete";

  try {
    const result = await completeLesson(userId, params.lessonId, reason);

    let xp: Awaited<ReturnType<typeof onLessonCompleted>> | null = null;
    if (result.newlyCompleted) {
      xp = await onLessonCompleted({
        userId,
        courseId: result.courseId,
        lessonId: result.lessonId,
      });
    }
    let courseBadges: Awaited<ReturnType<typeof onCourseCompleted>> | null = null;
    if (result.courseCompleted) {
      courseBadges = await onCourseCompleted({ userId, courseId: result.courseId });
    }

    // B4 — log the path event when a learner accepts a skip suggestion.
    if (reason === "skipped" && result.newlyCompleted) {
      await recordPathSuggestion({
        userId,
        courseId: result.courseId,
        suggestionType: "skip",
        targetLessonId: result.lessonId,
        reason: "accepted_skip",
      });
    }

    return NextResponse.json({ ...result, xp, courseBadges });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
