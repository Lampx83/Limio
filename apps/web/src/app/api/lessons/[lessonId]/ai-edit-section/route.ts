import { NextResponse } from "next/server";
import { z } from "zod";
import { AiGenerationError, AiTutorError, SECTION_EDIT_ACTIONS, editLessonSection } from "@feedbackme/core-feedback";
import { LessonDraftError, assertCanEditLesson, emitEvent } from "@feedbackme/core-lms";
import { LearningEventType } from "@feedbackme/shared-types";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";
import { getOpenaiClient } from "@/lib/openaiClient";

export const runtime = "nodejs";
export const maxDuration = 120;

const str = z.string().max(4000);
const Body = z.object({
  action: z.enum(SECTION_EDIT_ACTIONS),
  lessonTitle: z.string().max(300).default(""),
  title: z.string().max(300),
  layout: z.string().max(20),
  intro: z.array(str).max(60),
  parts: z.array(z.object({ title: str, paragraphs: z.array(str).max(40), bullets: z.array(str).max(40) })).max(20),
  boxes: z.array(z.object({ kind: z.string().max(20), title: str, paragraphs: z.array(str).max(30) })).max(10),
});

/**
 * POST — "Nhờ AI" sửa MỘT mục của bài học (S2). Không ghi gì vào bài: trả bản
 * đề xuất để giảng viên so cũ/mới rồi tự chọn dùng hay bỏ. Trừ vào ví token AI.
 */
export async function POST(req: Request, { params }: { params: { lessonId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let courseId: string;
  try {
    courseId = (await assertCanEditLesson(userId, params.lessonId)).courseId;
  } catch (e) {
    if (e instanceof LessonDraftError) return NextResponse.json({ error: e.code }, { status: e.code === "forbidden" ? 403 : 404 });
    throw e;
  }
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return NextResponse.json({ error: "validation_failed" }, { status: 400 });

  let openai;
  try {
    openai = await getOpenaiClient();
  } catch (e) {
    if ((e as Error).message === "openai_not_configured") return NextResponse.json({ error: "openai_not_configured" }, { status: 503 });
    throw e;
  }

  try {
    const draft = await editLessonSection(userId, parsed.data, openai);
    await emitEvent(
      userId,
      LearningEventType.LessonContentAiEdited,
      { lessonId: params.lessonId, action: parsed.data.action, layout: parsed.data.layout },
      { courseId },
    );
    return NextResponse.json({ draft });
  } catch (e) {
    if (e instanceof AiTutorError) return NextResponse.json({ error: e.code, details: e.details }, { status: 429 });
    if (e instanceof AiGenerationError) {
      return NextResponse.json({ error: e.code, details: e.details }, { status: e.code === "validation_failed" ? 400 : 502 });
    }
    throw e;
  }
}
