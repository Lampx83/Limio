import { NextResponse } from "next/server";
import { overrideSubmissionScore } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

/** GV chỉnh điểm riêng một thành viên của bài nhóm; `score: null` bỏ chỉnh. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await overrideSubmissionScore(userId, params.id, await readJson(req));
    return NextResponse.json({ ok: true });
  } catch (e) {
    const m = mapKnownError(e);
    if (m) return m;
    throw e;
  }
}
