import { NextResponse } from "next/server";
import {
  AiGenerationError,
  AiTutorError,
  generateQuestions,
  QuestionDraftInput,
} from "@feedbackme/core-feedback";
import { canEditCourse, isAdmin } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";
import { getOpenaiClient } from "@/lib/openaiClient";

export const runtime = "nodejs";

/**
 * Generate quiz question drafts from a lesson's content.
 * Body: { lessonId, count?, difficulty? }
 *   OR { rawText, count?, difficulty? } for ad-hoc preview.
 * Authz: course editor (when lessonId given) OR any-instructor for rawText.
 */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await readJson(req)) as
    | {
        lessonId?: string;
        rawText?: string;
        count?: number;
        difficulty?: "easy" | "medium" | "hard";
      }
    | null;
  if (!body) return NextResponse.json({ error: "validation_failed" }, { status: 400 });

  let lessonContent = "";
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
    const parts: string[] = [`# ${lesson.title}`];
    if (lesson.description) parts.push(lesson.description);
    const TEXT_KEYS = [
      "body",
      "text",
      "content",
      "transcript",
      "transcriptText",
      "caption",
      "title",
      "description",
      "summary",
      "url",
    ];
    for (const c of lesson.contentItems) {
      const p = (c.payload ?? {}) as Record<string, unknown>;
      const chunk: string[] = [];
      for (const k of TEXT_KEYS) {
        const v = p[k];
        if (typeof v === "string" && v.trim()) chunk.push(v.trim());
      }
      if (chunk.length) parts.push(`[${c.type}] ${chunk.join(" — ")}`);
    }
    lessonContent = parts.join("\n\n");
    if (lessonContent.trim().length < 20) {
      return NextResponse.json(
        {
          error: "lesson_content_too_short",
          message:
            "Bài học chưa có đủ nội dung văn bản để AI sinh câu hỏi. Hãy thêm phần mô tả hoặc một content item dạng markdown/transcript.",
        },
        { status: 400 },
      );
    }
  } else if (body.rawText) {
    lessonContent = body.rawText;
  } else {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  if (courseId) {
    if (!(await canEditCourse(userId, courseId))) {
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

  const parsed = QuestionDraftInput.safeParse({
    lessonContent,
    count: body.count ?? 3,
    difficulty: body.difficulty ?? "medium",
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", details: parsed.error.flatten() },
      { status: 400 },
    );
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
    const drafts = await generateQuestions(userId, parsed.data, openai);
    return NextResponse.json({ drafts });
  } catch (e) {
    if (e instanceof AiTutorError) {
      // Vượt trần token — 429 chứ không phải 400: người gọi không sai gì,
      // chỉ là hết hạn mức, và thử lại sau thì được.
      return NextResponse.json(
        { error: e.code, details: e.details },
        { status: 429 },
      );
    }
    if (e instanceof AiGenerationError) {
      return NextResponse.json(
        { error: e.code, details: e.details },
        { status: 400 },
      );
    }
    throw e;
  }
}
