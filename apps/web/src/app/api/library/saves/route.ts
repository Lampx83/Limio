import { NextResponse } from "next/server";
import { saveLibraryCourse, unsaveLibraryCourse } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

// LANG đợt 2 — Lưu / bỏ lưu một giáo trình ở Thư viện giáo trình. Body: { courseId: string }.
// Chỉ chạm hàng của CHÍNH người gọi; khoá không nằm trong thư viện thì 404 và không tạo hàng.

function courseIdOf(body: unknown): string | null {
  const id = (body as { courseId?: unknown } | null)?.courseId;
  return typeof id === "string" && id.length > 0 && id.length <= 100 ? id : null;
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const courseId = courseIdOf(await readJson(req));
  if (!courseId) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try {
    return NextResponse.json(await saveLibraryCourse(userId, courseId));
  } catch (e) {
    return mapKnownError(e) ?? (() => { throw e; })();
  }
}

export async function DELETE(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const courseId = courseIdOf(await readJson(req));
  if (!courseId) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try {
    return NextResponse.json(await unsaveLibraryCourse(userId, courseId));
  } catch (e) {
    return mapKnownError(e) ?? (() => { throw e; })();
  }
}
