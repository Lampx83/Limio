import { NextResponse } from "next/server";
import { z } from "zod";
import { AiGenerationError, AiTutorError, SECTION_EDIT_ACTIONS, editLessonBlock } from "@feedbackme/core-feedback";
import { LessonDraftError, emitEvent, getLessonDraft } from "@feedbackme/core-lms";
import { LearningEventType } from "@feedbackme/shared-types";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";
import { getOpenaiClient } from "@/lib/openaiClient";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({
  action: z.enum(SECTION_EDIT_ACTIONS),
  text: z.string().min(1).max(6000),
  heading: z.string().max(300).default(""),
});

/**
 * POST — "Nhờ AI" sửa MỘT đoạn của bài giữ nguyên định dạng. Không ghi gì vào bài:
 * trả bản đề xuất để giảng viên so cũ/mới rồi tự chọn dùng hay bỏ. Trừ vào ví token AI.
 */
export async function POST(req: Request, { params }: { params: { draftId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try {
    const draft = await getLessonDraft(userId, params.draftId);
    if (draft.status !== "outline" || !draft.outline.keepFormat) return NextResponse.json({ error: "invalid_state" }, { status: 409 });

    let openai;
    try {
      openai = await getOpenaiClient();
    } catch (e) {
      if ((e as Error).message === "openai_not_configured") return NextResponse.json({ error: "openai_not_configured" }, { status: 503 });
      throw e;
    }

    const proposal = await editLessonBlock(
      userId,
      { lessonTitle: draft.result?.lessons[0]?.title || draft.lessonTitle, heading: parsed.data.heading, text: parsed.data.text, action: parsed.data.action },
      openai,
    );
    await emitEvent(
      userId,
      LearningEventType.LessonContentAiEdited,
      { lessonId: draft.lessonId, action: parsed.data.action, layout: "keep_format" },
      { courseId: draft.courseId },
    );
    return NextResponse.json({ proposal });
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
