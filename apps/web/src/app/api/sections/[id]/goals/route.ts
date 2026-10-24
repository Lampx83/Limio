import { NextResponse } from "next/server";
import { listSectionLearnerGoals } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";
import { loadLearnerGoalProgress } from "@/lib/goalProgress";

export const runtime = "nodejs";

/** Giáo viên: từng học viên của lớp kèm mục tiêu và tiến độ (nhãn + nhận định). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ rows: await loadLearnerGoalProgress(userId, params.id) });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
