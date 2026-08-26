import { NextResponse } from "next/server";
import { listExamResults } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/**
 * Danh sách kết quả của một bài thi cho màn hình giáo viên.
 *
 * Khác `/results` (xuất CSV kèm điểm từng câu) và `/gradebook` (xuất CSV theo
 * thí sinh có mã): đây là dữ liệu cho MÀN HÌNH, gom cả hai kiểu người làm.
 *
 * Query: ?sessionId=<uuid>&roomId=<uuid> — bộ lọc, đều không bắt buộc.
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId") ?? undefined;
  const roomId = url.searchParams.get("roomId") ?? undefined;

  try {
    const r = await listExamResults(userId, params.id, { sessionId, roomId });
    return NextResponse.json(r);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
