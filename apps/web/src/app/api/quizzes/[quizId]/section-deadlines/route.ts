import { NextResponse } from "next/server";
import { getQuizDeadlines, setQuizSectionSchedules } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** Lịch chung + lịch riêng từng lớp của một quiz (chỉ người sửa được khoá). */
export async function GET(_req: Request, { params }: { params: { quizId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await getQuizDeadlines(userId, params.quizId));
  } catch (e) {
    const m = mapKnownError(e);
    if (m) return m;
    throw e;
  }
}

/**
 * Body: { sectionIds: string[], change: { mode: "inherit" } | { mode: "custom", opensAt: ISO | null, dueAt: ISO | null } }.
 */
export async function PUT(req: Request, { params }: { params: { quizId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  try {
    await setQuizSectionSchedules(userId, params.quizId, body);
    return NextResponse.json(await getQuizDeadlines(userId, params.quizId));
  } catch (e) {
    const m = mapKnownError(e);
    if (m) return m;
    throw e;
  }
}
