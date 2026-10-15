import { NextResponse } from "next/server";
import { getExamSession } from "@feedbackme/core-lms";
import { mapKnownError } from "@/lib/apiHelpers";
import { requireUserId } from "@/lib/session";
import { lobbyCount } from "@/lib/exam-lobby-presence";

export const runtime = "nodejs";

/**
 * GET /api/exam-sessions/[id]/lobby — số học viên đang chờ trong lobby của ca.
 * Chỉ người có quyền xem ca mới đọc được (getExamSession kiểm tra quyền).
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await getExamSession(userId, params.id);
    return NextResponse.json({ waiting: await lobbyCount(params.id) });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
