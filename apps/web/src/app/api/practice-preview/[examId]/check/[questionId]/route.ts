import { NextResponse } from "next/server";
import { previewPracticeCheck } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/**
 * Xem trước Bài luyện của GIẢNG VIÊN: chấm một đáp án như học viên nhưng KHÔNG tạo buổi luyện, KHÔNG lưu đáp án, KHÔNG ghi sự
 * kiện, KHÔNG ghi nhận kỹ năng. Chỉ đề có chủ (nội dung của một khối Bài luyện) và chỉ người sửa được khoá chứa đề.
 */
export async function POST(req: Request, { params }: { params: { examId: string; questionId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as { answerJson?: unknown } | null;
  try {
    return NextResponse.json(await previewPracticeCheck(userId, params.examId, params.questionId, body?.answerJson ?? null));
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
