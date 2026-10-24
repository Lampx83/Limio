import { NextResponse } from "next/server";
import { adoptSectionGoal } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** "Dùng mục tiêu này" (C6.4): chép mục tiêu của lớp thành mục tiêu riêng. { courseId, targetDate?, hoursPerWeek? }. */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as { courseId?: string; targetDate?: string; hoursPerWeek?: number | null } | null;
  if (!body?.courseId) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try {
    return NextResponse.json(await adoptSectionGoal(userId, body.courseId, { targetDate: body.targetDate, hoursPerWeek: body.hoursPerWeek }), { status: 201 });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
