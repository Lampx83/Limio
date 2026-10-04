import { NextResponse } from "next/server";
import { ExamError, getMockAttemptResult, getMockAttemptResultForStaff } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/**
 * LANG G5d.7 — kết quả theo phần của lượt thi thử. Chủ lượt thi xem lượt CỦA MÌNH; người không phải
 * chủ thì thử quyền chấm đề (giảng viên/trợ giảng), không có quyền → 403/404 như các API kết quả khác.
 * Đề thường → 404 (không có kết quả theo phần).
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    let r;
    try {
      r = await getMockAttemptResult(userId, params.id);
    } catch (e) {
      if (e instanceof ExamError && e.code === "attempt_belongs_to_other") {
        r = await getMockAttemptResultForStaff(userId, params.id);
      } else throw e;
    }
    if (!r) return NextResponse.json({ error: "not_mock_exam" }, { status: 404 });
    return NextResponse.json(r);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
