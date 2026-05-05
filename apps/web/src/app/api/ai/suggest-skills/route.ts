import { NextResponse } from "next/server";
import {
  AiGenerationError,
  suggestSkillsForContent,
} from "@feedbackme/core-feedback";
import { canEditCourse, isAdmin } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";
import { getOpenaiClient } from "@/lib/openaiClient";

export const runtime = "nodejs";

/**
 * Suggest skill tags for a piece of content. Body shape:
 *   { lessonId } — pull lesson title + content items as input
 *   { questionId } — pull question prompt + options as input
 *   { rawText } — fallback, ad-hoc text (used by question-draft preview)
 *
 * Authz: instructor of the relevant course or admin.
 */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as
    | { lessonId?: string; questionId?: string; rawText?: string }
    | null;
  if (!body) return NextResponse.json({ error: "validation_failed" }, { status: 400 });

  let contentText = "";
  let courseId: string | null = null;

  if (body.lessonId) {
    const lesson = await prisma.lesson.findUnique({
      where: { id: body.lessonId },
      include: {
        module: { select: { courseId: true } },
        contentItems: { orderBy: { orderIndex: "asc" } },
      },
    });
    if (!lesson) return NextResponse.json({ error: "not_found" }, { status: 404 });
    courseId = lesson.module.courseId;
    const parts: string[] = [lesson.title];
    if (lesson.description) parts.push(lesson.description);
    for (const c of lesson.contentItems) {
      const p = (c.payload ?? {}) as Record<string, unknown>;
      if (c.type === "markdown" && typeof p.body === "string") parts.push(p.body);
      else if (typeof p.title === "string") parts.push(`[${c.type}] ${p.title}`);
    }
    contentText = parts.join("\n\n");
  } else if (body.questionId) {
    const q = await prisma.quizQuestion.findUnique({
      where: { id: body.questionId },
      include: {
        options: true,
        quiz: { select: { courseId: true } },
      },
    });
    if (!q) return NextResponse.json({ error: "not_found" }, { status: 404 });
    courseId = q.quiz.courseId;
    contentText = [
      `Question (${q.type}): ${q.prompt}`,
      ...q.options.map(
        (o, i) => `Option ${i + 1}: ${o.label}${o.isCorrect ? " ✓" : ""}`,
      ),
      q.explanation ? `Explanation: ${q.explanation}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  } else if (body.rawText) {
    contentText = body.rawText;
  } else {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  // Authz: course-scoped requests need editor rights; rawText (no course) needs
  // any-instructor-or-admin since we don't know which course this affects.
  if (courseId) {
    if (!(await canEditCourse(userId, courseId)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  } else {
    const [admin, anyCourse] = await Promise.all([
      isAdmin(userId),
      prisma.courseInstructor.findFirst({ where: { userId } }),
    ]);
    if (!admin && !anyCourse) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
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
    const suggestions = await suggestSkillsForContent(userId, contentText, openai);
    return NextResponse.json({ suggestions });
  } catch (e) {
    if (e instanceof AiGenerationError) {
      return NextResponse.json(
        { error: e.code, details: e.details },
        { status: 400 },
      );
    }
    throw e;
  }
}
