import { NextResponse } from "next/server";
import { LessonDraftError, assertCanEditLesson, createLessonDraft } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { DEFAULT_LESSON_LOOK, readLessonLook } from "@feedbackme/shared-types";
import { requireUserId } from "@/lib/session";
import { outlineFromLessonHtml } from "@/lib/lessonFromContent";

export const runtime = "nodejs";

/**
 * POST — "Làm lại từ dàn ý" (S4): mở bản nháp mới có dàn ý dựng từ chính khối Văn bản
 * này (không gọi AI, không tốn token). Khi Áp dụng, khối được THAY và bản hiện tại
 * vào lịch sử (before_regenerate). Trả { draftId, courseId, lessonId } để mở màn Dàn ý.
 */
export async function POST(_req: Request, { params }: { params: { contentId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const item = await prisma.contentItem.findUnique({
    where: { id: params.contentId },
    select: { id: true, type: true, payload: true, lessonId: true, lesson: { select: { title: true } } },
  });
  if (!item || item.type !== "richtext") return NextResponse.json({ error: "not_found" }, { status: 404 });
  try {
    const { courseId } = await assertCanEditLesson(userId, item.lessonId);
    const payload = item.payload as { html?: string; look?: unknown };
    const { paras, outline } = outlineFromLessonHtml(payload.html ?? "", item.lesson.title);
    if (paras.length === 0) return NextResponse.json({ error: "empty_content" }, { status: 422 });
    const draft = await createLessonDraft(userId, item.lessonId, {
      sourceName: `Bài hiện tại: ${item.lesson.title}`,
      sourceKind: "lesson",
      sourceParas: paras,
      outline,
      look: readLessonLook(payload.look) ?? DEFAULT_LESSON_LOOK,
      targetContentItemId: item.id,
    });
    return NextResponse.json({ draftId: draft.id, courseId, lessonId: item.lessonId });
  } catch (e) {
    if (e instanceof LessonDraftError) return NextResponse.json({ error: e.code }, { status: e.code === "forbidden" ? 403 : 404 });
    throw e;
  }
}
