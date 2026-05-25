import { NextResponse } from "next/server";
import {
  CourseAuthzError,
  CourseError,
  reorderContentItems,
} from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/**
 * Reorder ContentItems within a lesson. Body: `{ orderedContentItemIds: string[] }`
 * — must include every ContentItem currently attached to the lesson.
 */
export async function POST(
  req: Request,
  { params }: { params: { lessonId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as { orderedContentItemIds?: string[] } | null;
  if (!body?.orderedContentItemIds || !Array.isArray(body.orderedContentItemIds)) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  try {
    await reorderContentItems(userId, params.lessonId, body.orderedContentItemIds);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof CourseError || e instanceof CourseAuthzError) {
      return NextResponse.json({ error: e.code }, { status: 400 });
    }
    throw e;
  }
}
