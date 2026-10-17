import { NextResponse } from "next/server";
import { restoreContentVersion } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

/** POST — khôi phục khối về một phiên bản; bản hiện tại được chụp lại trước (hoàn tác được). */
export async function POST(_req: Request, { params }: { params: { contentId: string; versionId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await restoreContentVersion(userId, params.contentId, params.versionId));
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
