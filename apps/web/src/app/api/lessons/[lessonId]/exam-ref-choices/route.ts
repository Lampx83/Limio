import { NextResponse } from "next/server";
import { listExamRefChoicesForLesson } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** Các đề thi thử của khoá chứa bài, để chọn gắn vào khối "Đề thi". Chỉ người sửa được khoá. */
export async function GET(_req: Request, { params }: { params: { lessonId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await listExamRefChoicesForLesson(userId, params.lessonId));
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
