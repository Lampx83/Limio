import { NextResponse } from "next/server";
import { listTeacherMeetings } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** Lịch dạy của giảng viên: ?from=YYYY-MM-DD&to=YYYY-MM-DD[&sectionId=…]. */
export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const q = new URL(req.url).searchParams;
  try {
    const meetings = await listTeacherMeetings(userId, {
      from: q.get("from") ?? "",
      to: q.get("to") ?? "",
      sectionId: q.get("sectionId") ?? undefined,
    });
    return NextResponse.json({ meetings });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
