import { NextResponse } from "next/server";
import { setGoal } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/**
 * Đặt mục tiêu học tập (C6.1). Học viên tự đặt: { courseId?, framework, targetLevel, targetDate, hoursPerWeek? }.
 * Giáo viên đặt hộ thêm `userId` và bắt buộc có `courseId` của khoá mình dạy.
 */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await setGoal(userId, await readJson(req)), { status: 201 });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
