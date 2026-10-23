import { NextResponse } from "next/server";
import { getMyAttendanceSummary, listMyAttendance } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** Điểm danh của chính người đăng nhập: ?from=YYYY-MM-DD&to=YYYY-MM-DD. Không có ghi chú của giáo viên. */
export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const q = new URL(req.url).searchParams;
  try {
    const [rows, summary] = await Promise.all([
      listMyAttendance(userId, { from: q.get("from") ?? "", to: q.get("to") ?? "" }),
      getMyAttendanceSummary(userId),
    ]);
    return NextResponse.json({ rows, summary });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
