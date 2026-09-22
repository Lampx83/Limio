import { NextResponse } from "next/server";
import { AiGenerationError, AiTutorError, formatLessonContent } from "@feedbackme/core-feedback";
import { canEditCourse } from "@feedbackme/core-lms";
import { isLessonFormatTemplateKey } from "@feedbackme/shared-types";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";
import { getOpenaiClient } from "@/lib/openaiClient";

export const runtime = "nodejs";

/**
 * "Định dạng bằng AI" — nhận HTML thô đang có trong ô richtext + template đã
 * chọn, trả về HTML đã định dạng để FE hiện preview. KHÔNG ghi DB — instructor
 * bấm "Áp dụng" ở FE mới thay nội dung trong ô, rồi tự lưu như bình thường.
 */
export async function POST(
  req: Request,
  { params }: { params: { lessonId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await readJson(req)) as { html?: string; template?: string } | null;
  if (!body || typeof body.html !== "string" || !body.html.trim()) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  if (!isLessonFormatTemplateKey(body.template)) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  const lesson = await prisma.lesson.findUnique({
    where: { id: params.lessonId },
    select: { module: { select: { courseId: true } } },
  });
  if (!lesson) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!(await canEditCourse(userId, lesson.module.courseId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let openai;
  try {
    openai = await getOpenaiClient();
  } catch (e) {
    if ((e as Error).message === "openai_not_configured") {
      return NextResponse.json({ error: "openai_not_configured" }, { status: 503 });
    }
    throw e;
  }

  try {
    const result = await formatLessonContent(userId, { html: body.html, template: body.template }, openai);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AiTutorError) {
      return NextResponse.json({ error: e.code, details: e.details }, { status: 429 });
    }
    if (e instanceof AiGenerationError) {
      return NextResponse.json({ error: e.code, details: e.details }, { status: 400 });
    }
    throw e;
  }
}
