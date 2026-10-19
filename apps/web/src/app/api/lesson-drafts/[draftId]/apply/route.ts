import { NextResponse } from "next/server";
import { CourseError, LessonDraftError, applyLessonDraft } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

/**
 * POST — "Áp dụng" bài AI đã viết vào khoá học (T7): bài 1 thành khối Văn bản
 * cuối bài đang mở, các bài sau thành bài học mới ẩn ngay sau. Một transaction.
 */
export async function POST(_req: Request, { params }: { params: { draftId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await applyLessonDraft(userId, params.draftId));
  } catch (e) {
    if (e instanceof LessonDraftError) {
      const status = e.code === "forbidden" ? 403 : e.code === "not_found" ? 404 : 409;
      return NextResponse.json({ error: e.code }, { status });
    }
    if (e instanceof CourseError) return NextResponse.json({ error: e.code, details: e.details }, { status: 400 });
    throw e;
  }
}
