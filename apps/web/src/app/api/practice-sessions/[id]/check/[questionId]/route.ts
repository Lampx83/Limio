import { NextResponse } from "next/server";
import { checkPracticeAnswer, observePracticeAnswer } from "@feedbackme/core-lms";
import { requestPracticeAnswerFeedback, updateLearnerStateForLessonObservation } from "@feedbackme/core-feedback";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";
import { getOpenaiClient } from "@/lib/openaiClient";
import { feedbackErrorCode, publicFeedback, type PracticeFeedbackErrorCode } from "@/lib/practiceAnswerApi";

export const runtime = "nodejs";
export const maxDuration = 120; // câu mở: mô hình viết góp ý có thể mất hơn một lượt gọi thường

/**
 * LANG G5e.4 — Kiểm tra một câu: trả đúng/sai và đáp án đúng. CHỈ dành cho buổi luyện — id lượt
 * thi thử không thuộc bảng này nên luôn bị từ chối (không có đường lộ đáp án trong lúc thi).
 *
 * LANG đợt 4 — thân tuỳ chọn `{ lessonId }` do Bài luyện nhúng trong bài gửi lên. Nếu liên kết hợp lệ (core-lms kiểm,
 * không tin máy khách) thì LẦN KIỂM TRA ĐẦU TIÊN của mỗi (buổi, câu) là một lượt quan sát kỹ năng cho các skill gắn vào bài
 * (BKT). Tầng này là nơi duy nhất nối hai gói (core-lms không import core-feedback, §4.3). Lỗi ở cầu nối không bao giờ làm
 * hỏng việc kiểm tra: học viên vẫn nhận kết quả.
 *
 * Câu mở (`essay`, chấm tay) của khoá ngoại ngữ có `aiFeedback` bật: ngay sau khi kiểm tra, sinh góp ý AI cho câu trả lời
 * (docs/tieu-chi/bai-luyen-tra-loi-bang-giong-noi-va-bai-mau.md, AC4) và trả kèm `feedback`; cùng câu trả lời thì dùng lại
 * bản cũ (`feedbackReused`). Lỗi AI (chưa cấu hình, hết hạn mức, mô hình lỗi...) KHÔNG làm hỏng việc kiểm tra: kết quả vẫn
 * trả (kèm bài mẫu trong `config`) cùng `feedbackError` là mã ngắn. Toạ độ SSMMD và số mục bị lọc không ra trình duyệt.
 */
export async function POST(req: Request, { params }: { params: { id: string; questionId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as { lessonId?: unknown; restore?: unknown } | null;
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
    // `restore: true` = giao diện chỉ nạp lại kết quả khi mở bài (góp ý đã lưu nằm sẵn trong dữ liệu bài): không tự gọi AI mà
    // học viên chưa bấm "Kiểm tra".
    if (result.manual && body?.restore !== true && (result.config as { aiFeedback?: unknown } | null)?.aiFeedback !== false) {
      return NextResponse.json({ ...result, ...(await essayFeedback(userId, params.id, params.questionId)) });
    }
    return NextResponse.json(result);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}

/**
 * Góp ý AI cho câu mở vừa kiểm tra. Luôn trả một đối tượng gộp được vào kết quả, không bao giờ ném. Chỉ khoá ngoại ngữ có
 * góp ý (core-feedback kiểm `languageMode`): khoá khác/câu không phải essay trả `not_language_course`/`not_essay` và ở đây
 * được im lặng bỏ qua (không có góp ý, không có lỗi hiển thị), vì đó không phải điều học viên cần biết.
 */
async function essayFeedback(
  userId: string,
  sessionId: string,
  questionId: string,
): Promise<{ feedback?: unknown; feedbackReused?: boolean; feedbackError?: PracticeFeedbackErrorCode }> {
  try {
    const r = await requestPracticeAnswerFeedback(userId, sessionId, questionId, {
      // Lấy khách hàng AI chậm: bản cũ (cùng đầu vào) không đòi cấu hình AI.
      openai: () => getOpenaiClient(),
    });
    return { feedback: publicFeedback(r.body), feedbackReused: r.reused };
  } catch (e) {
    const code = (e as { code?: unknown } | null)?.code;
    if (code === "not_language_course" || code === "not_essay" || code === "feedback_disabled") return {};
    const mapped = feedbackErrorCode(e);
    if (mapped === "failed") console.error("[POST /api/practice-sessions/:id/check/:questionId] feedback failed", e);
    return { feedbackError: mapped };
  }
}
