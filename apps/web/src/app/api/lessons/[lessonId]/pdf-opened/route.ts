import { NextResponse } from "next/server";
import { recordPdfOpenedExternal } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

/**
 * Học viên bấm "Mở PDF trong tab mới". Máy khách gọi nền (keepalive) và không chờ,
 * nên trả 204 không kèm nội dung — xem recordPdfOpenedExternal.
 */
export async function POST(
  req: Request,
  { params }: { params: { lessonId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as { contentItemId?: unknown } | null;
  try {
    await recordPdfOpenedExternal(userId, params.lessonId, body?.contentItemId);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
