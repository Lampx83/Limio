import { NextResponse } from "next/server";
import { AiGenerationError, AiTutorError, writeObjectivesSummary } from "@feedbackme/core-feedback";
import { LessonDraftError, emitEvent, getLessonDraft, setKeepFormatHtml } from "@feedbackme/core-lms";
import { LearningEventType } from "@feedbackme/shared-types";
import { requireUserId } from "@/lib/session";
import { getOpenaiClient } from "@/lib/openaiClient";
import { htmlWordCount, plainTextOfHtml } from "@/lib/lessonKeepFormat";
import { renderObjectivesBox, renderSummaryBox, stripObjectivesSummary } from "@/lib/lessonRender";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST — "Thêm Mục tiêu và Tổng kết" cho bài giữ nguyên định dạng. Chỉ chạy khi
 * giảng viên bấm; AI rút từ chính chữ của bài, rồi hộp Mục tiêu đặt đầu bài, hộp
 * Tổng kết đặt cuối bài (bấm lại thì thay bản cũ, không lặp). Trừ vào ví token AI.
 */
export async function POST(_req: Request, { params }: { params: { draftId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const draft = await getLessonDraft(userId, params.draftId);
    const lesson = draft.result?.lessons[0];
    if (draft.status !== "outline" || !draft.outline.keepFormat || !lesson) {
      return NextResponse.json({ error: "invalid_state" }, { status: 409 });
    }

    let openai;
    try {
      openai = await getOpenaiClient();
    } catch (e) {
      if ((e as Error).message === "openai_not_configured") return NextResponse.json({ error: "openai_not_configured" }, { status: 503 });
      throw e;
    }

    const base = stripObjectivesSummary(lesson.html);
    if (htmlWordCount(base) === 0) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
    const { objectives, summary } = await writeObjectivesSummary(
      userId,
      { lessonTitle: lesson.title || draft.lessonTitle, text: plainTextOfHtml(base) },
      openai,
    );
    const html = `${renderObjectivesBox(objectives)}${base}${renderSummaryBox(summary)}`;
    await setKeepFormatHtml(userId, params.draftId, html);
    await emitEvent(
      userId,
      LearningEventType.LessonContentAiEdited,
      { lessonId: draft.lessonId, action: "objectives_summary", layout: "keep_format" },
      { courseId: draft.courseId },
    );
    return NextResponse.json({ html });
  } catch (e) {
    if (e instanceof LessonDraftError) {
      return NextResponse.json({ error: e.code }, { status: e.code === "forbidden" ? 403 : e.code === "not_found" ? 404 : 409 });
    }
    if (e instanceof AiTutorError) return NextResponse.json({ error: e.code, details: e.details }, { status: 429 });
    if (e instanceof AiGenerationError) {
      return NextResponse.json({ error: e.code, details: e.details }, { status: e.code === "validation_failed" ? 400 : 502 });
    }
    throw e;
  }
}
