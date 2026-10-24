import { NextResponse } from "next/server";
import { changeGoal, setGoalStatus } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/**
 * Đổi mục tiêu hoặc trạng thái (C6.7). { patch?: { framework?, targetLevel?, targetDate?, hoursPerWeek? },
 * status?: "active" | "achieved" | "archived" }. Mọi thay đổi phát event goal.* mang giá trị cũ và mới.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as { patch?: unknown; status?: "active" | "achieved" | "archived" } | null;
  if (!body || (body.patch === undefined && body.status === undefined)) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  try {
    let goal;
    if (body.patch !== undefined) goal = await changeGoal(userId, params.id, body.patch);
    if (body.status !== undefined) goal = await setGoalStatus(userId, params.id, body.status);
    return NextResponse.json(goal);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
