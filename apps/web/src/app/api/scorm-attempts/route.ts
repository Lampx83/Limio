import { NextResponse } from "next/server";
import { getOrCreateAttempt } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as
    | { packageId?: string; courseId?: string; lessonId?: string }
    | null;
  if (!body?.packageId) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  const a = await getOrCreateAttempt(userId, body.packageId, {
    courseId: body.courseId ?? null,
    lessonId: body.lessonId ?? null,
  });
  return NextResponse.json({
    attemptId: a.id,
    lessonStatus: a.lessonStatus,
    suspendData: a.suspendData,
    location: a.location,
    scoreRaw: a.scoreRaw,
    totalTime: a.totalTime,
  });
}
