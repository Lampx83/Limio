import { NextResponse } from "next/server";
import { checkPracticeAnswer, observePracticeAnswer } from "@feedbackme/core-lms";
import { updateLearnerStateForLessonObservation } from "@feedbackme/core-feedback";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/**
 * LANG G5e.4 — Kiểm tra một câu: trả đúng/sai và đáp án đúng. CHỈ dành cho buổi luyện — id lượt
 * thi thử không thuộc bảng này nên luôn bị từ chối (không có đường lộ đáp án trong lúc thi).
 *
 * LANG đợt 4 — thân tuỳ chọn `{ lessonId }` do Bài luyện nhúng trong bài gửi lên. Nếu liên kết hợp lệ (core-lms kiểm,
 * không tin máy khách) thì LẦN KIỂM TRA ĐẦU TIÊN của mỗi (buổi, câu) là một lượt quan sát kỹ năng cho các skill gắn vào bài
 * (BKT). Tầng này là nơi duy nhất nối hai gói (core-lms không import core-feedback, §4.3). Lỗi ở cầu nối không bao giờ làm
 * hỏng việc kiểm tra: học viên vẫn nhận kết quả.
 */
export async function POST(req: Request, { params }: { params: { id: string; questionId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as { lessonId?: unknown } | null;
  const lessonId = typeof body?.lessonId === "string" && body.lessonId.length > 0 && body.lessonId.length <= 100 ? body.lessonId : null;
  try {
    const result = await checkPracticeAnswer(userId, params.id, params.questionId);
    if (lessonId && !result.manual && result.isCorrect !== null) {
      try {
        const obs = await observePracticeAnswer(userId, params.id, params.questionId, lessonId);
        if (obs.created && obs.correct !== null) {
          await updateLearnerStateForLessonObservation(userId, lessonId, obs.correct, undefined, "practice");
        }
      } catch (e) {
        console.error("[POST /api/practice-sessions/:id/check/:questionId] observation failed", e);
      }
    }
    return NextResponse.json(result);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
