import { NextResponse } from "next/server";
import { getAssignmentDeadlines, setAssignmentSectionDeadlines } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** Hạn chung + hạn riêng từng lớp của một bài tập (chỉ người sửa được khoá). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await getAssignmentDeadlines(userId, params.id));
  } catch (e) {
    const m = mapKnownError(e);
    if (m) return m;
    throw e;
  }
}

/**
 * Body: { sectionIds: string[], change: { mode: "inherit" } | { mode: "custom", dueAt: ISO | null } }.
 * Nhiều sectionIds = đặt chung một hạn cho nhiều lớp trong một lần lưu.
 */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  try {
    await setAssignmentSectionDeadlines(userId, params.id, body);
    return NextResponse.json(await getAssignmentDeadlines(userId, params.id));
  } catch (e) {
    const m = mapKnownError(e);
    if (m) return m;
    throw e;
  }
}
