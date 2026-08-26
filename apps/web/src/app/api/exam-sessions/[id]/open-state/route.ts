import { NextResponse } from "next/server";
import { setManualSessionOpen } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/**
 * Mở / đóng một ca thi chạy chế độ thủ công.
 *
 * Body: { open: boolean }
 * Ca hẹn giờ bị từ chối ở tầng service — đóng tay một ca theo lịch không có
 * tác dụng, để lọt qua thì GV tưởng đã đóng mà học sinh vẫn vào được.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await readJson(req)) as { open?: unknown } | null;
  if (typeof body?.open !== "boolean") {
    return NextResponse.json(
      { error: "validation_failed", details: "open must be a boolean" },
      { status: 400 },
    );
  }

  try {
    const r = await setManualSessionOpen(userId, params.id, body.open);
    return NextResponse.json(r);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
