import { NextResponse } from "next/server";
import { deleteContentItem, updateContentItem, cleanupOrphanedCuepointQuizzes } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

async function getLessonIdForContent(contentId: string): Promise<string | null> {
  const row = await prisma.contentItem.findUnique({
    where: { id: contentId },
    select: { lessonId: true, type: true },
  });
  return row?.type === "video" ? row.lessonId : null;
}

export async function PATCH(
  req: Request,
  { params }: { params: { contentId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  try {
    const lessonIdBefore = await getLessonIdForContent(params.contentId);
    await updateContentItem(userId, params.contentId, body);
    // After payload changes on a video item, prune any cuepoint quiz that's
    // no longer referenced. Best-effort — don't fail the request on it.
    if (lessonIdBefore) {
      await cleanupOrphanedCuepointQuizzes(userId, lessonIdBefore).catch(() => {});
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { contentId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    console.log(`[DELETE /api/contents] Deleting contentId=${params.contentId} for user=${userId}`);
    const lessonIdBefore = await getLessonIdForContent(params.contentId);
    await deleteContentItem(userId, params.contentId);
    if (lessonIdBefore) {
      await cleanupOrphanedCuepointQuizzes(userId, lessonIdBefore).catch(() => {});
    }
    console.log(`[DELETE /api/contents] Successfully deleted contentId=${params.contentId}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`[DELETE /api/contents] Error deleting contentId=${params.contentId}:`, e);
    const mapped = mapKnownError(e);
    if (mapped) {
      console.error(`[DELETE /api/contents] Mapped error:`, mapped);
      return mapped;
    }
    throw e;
  }
}
