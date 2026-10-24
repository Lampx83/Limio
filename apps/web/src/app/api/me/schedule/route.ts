import { NextResponse } from "next/server";
import { listLearnerMeetings } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** Lịch học của chính người đang đăng nhập: ?from=YYYY-MM-DD&to=YYYY-MM-DD. */
export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const q = new URL(req.url).searchParams;
  try {
    const meetings = await listLearnerMeetings(userId, { from: q.get("from") ?? "", to: q.get("to") ?? "" });
    return NextResponse.json({ meetings });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
