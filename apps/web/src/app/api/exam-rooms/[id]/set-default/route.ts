import { NextResponse } from "next/server";
import { setRoomAsDefault } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/**
 * Đánh dấu phòng này làm phòng mặc định của ca thi nó thuộc. Thí sinh join
 * exam open_code mà không nhập mã phòng sẽ tự gán vào đây.
 */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await setRoomAsDefault(userId, params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
