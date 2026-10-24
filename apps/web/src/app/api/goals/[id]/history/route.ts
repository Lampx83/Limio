import { NextResponse } from "next/server";
import { getGoalHistory } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** Lịch sử đặt và đổi một mục tiêu (C6.7), dựng từ event goal.*. Chỉ chủ nhân và giáo viên của lớp. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ history: await getGoalHistory(userId, params.id) });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
