import { NextResponse } from "next/server";
import { recordLessonEngagement } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

/**
 * B11 — nhịp đo thời gian đọc bài. Máy khách gọi mỗi 30 giây khi tab đang hiện,
 * và một lần cuối lúc rời bài (qua sendBeacon).
 *
 * Trả về 204 không kèm nội dung: đây là đường ghi số liệu, người học không chờ
 * gì ở đây, và mọi byte trả về đều là byte thừa trên một đường gọi lặp lại.
 */
export async function POST(
  req: Request,
  { params }: { params: { lessonId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    await recordLessonEngagement(userId, params.lessonId, body);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
