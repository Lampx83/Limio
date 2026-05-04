import { NextResponse } from "next/server";
import { deleteContentItem, updateContentItem } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export async function PATCH(
  req: Request,
  { params }: { params: { contentId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  try {
    await updateContentItem(userId, params.contentId, body);
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
    await deleteContentItem(userId, params.contentId);
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
