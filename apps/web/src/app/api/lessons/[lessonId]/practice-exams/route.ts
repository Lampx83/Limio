import { NextResponse } from "next/server";
import { listSelectablePracticeExams } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

// GET /api/lessons/[lessonId]/practice-exams — các đề thi thử đã xuất bản của khoá chứa bài, cho ô chọn đề của khối
// "Bài luyện". Chỉ người sửa được khoá.
export async function GET(_req: Request, { params }: { params: { lessonId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ exams: await listSelectablePracticeExams(userId, params.lessonId) });
  } catch (e) {
    return mapKnownError(e) ?? (() => { throw e; })();
  }
}
