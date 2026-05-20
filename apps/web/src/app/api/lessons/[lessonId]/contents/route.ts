import { NextResponse } from "next/server";
import { createContentItem, cleanupOrphanedCuepointQuizzes } from "@feedbackme/core-lms";
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
    const result = await createContentItem(userId, params.lessonId, body);
    // If the new content item is a video with cuepoints, this is a no-op
    // (nothing has been orphaned yet); but on subsequent edits the same
    // cleanup runs from the PATCH route below.
    if ((body as { type?: string })?.type === "video") {
      await cleanupOrphanedCuepointQuizzes(userId, params.lessonId).catch(() => {});
    }
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
