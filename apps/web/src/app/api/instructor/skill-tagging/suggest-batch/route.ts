import { NextResponse } from "next/server";
import {
  AiGenerationError,
  AiTutorError,
  assertWithinCaps,
  suggestSkillsForContent,
} from "@feedbackme/core-feedback";
import { canEditCourse } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";
import { getOpenaiClient } from "@/lib/openaiClient";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BATCH = 20;

type LessonResult = {
  kind: "lesson";
  id: string;
  title: string;
  courseId: string;
  suggestions: Array<{
    skillId: string;
    skillCode: string;
    skillName: string;
    confidence: number;
    rationale: string;
  }>;
  error?: string;
};

type QuestionResult = {
  kind: "question";
  id: string;
  prompt: string;
  courseId: string;
  suggestions: LessonResult["suggestions"];
  error?: string;
};

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Chặn một lần ở đầu thay vì để từng item đâm vào cap rồi hỏng lẻ tẻ: đây là
  // endpoint chạy theo lô, gọi generator một lần cho mỗi bài/câu hỏi.
  try {
    await assertWithinCaps(userId, prisma, "generator");
  } catch (e) {
    if (e instanceof AiTutorError) {
      return NextResponse.json(
        { error: e.code, details: e.details },
        { status: 429 },
      );
    }
    throw e;
  }

  const body = (await readJson(req)) as
    | { lessonIds?: string[]; questionIds?: string[] }
    | null;
  if (!body) return NextResponse.json({ error: "validation_failed" }, { status: 400 });

  const lessonIds = (body.lessonIds ?? []).slice(0, MAX_BATCH);
  const questionIds = (body.questionIds ?? []).slice(0, MAX_BATCH - lessonIds.length);
  if (lessonIds.length === 0 && questionIds.length === 0) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
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

  const results: Array<LessonResult | QuestionResult> = [];

  // Lessons
  if (lessonIds.length > 0) {
    const lessons = await prisma.lesson.findMany({
      where: { id: { in: lessonIds } },
      include: {
        module: { select: { courseId: true } },
        contentItems: { orderBy: { orderIndex: "asc" } },
      },
    });
    for (const lesson of lessons) {
      const courseId = lesson.module.courseId;
      if (!(await canEditCourse(userId, courseId))) {
        results.push({
          kind: "lesson",
          id: lesson.id,
          title: lesson.title,
          courseId,
          suggestions: [],
          error: "forbidden",
        });
        continue;
      }
      const parts: string[] = [lesson.title];
      if (lesson.description) parts.push(lesson.description);
      for (const c of lesson.contentItems) {
        const p = (c.payload ?? {}) as Record<string, unknown>;
        if (c.type === "markdown" && typeof p.body === "string") parts.push(p.body);
        else if (typeof p.title === "string") parts.push(`[${c.type}] ${p.title}`);
      }
      try {
        const suggestions = await suggestSkillsForContent(
          userId,
          parts.join("\n\n"),
          openai,
        );
        results.push({
          kind: "lesson",
          id: lesson.id,
          title: lesson.title,
          courseId,
          suggestions,
        });
      } catch (e) {
        results.push({
          kind: "lesson",
          id: lesson.id,
          title: lesson.title,
          courseId,
          suggestions: [],
          error:
            e instanceof AiGenerationError ? e.code : (e as Error).message,
        });
      }
    }
  }

  // Questions
  if (questionIds.length > 0) {
    const questions = await prisma.quizQuestion.findMany({
      where: { id: { in: questionIds } },
      include: {
        options: true,
        quiz: {
          select: {
            courseId: true,
            lesson: { select: { module: { select: { courseId: true } } } },
          },
        },
      },
    });
    for (const q of questions) {
      const courseId =
        q.quiz.courseId ?? q.quiz.lesson?.module?.courseId ?? "";
      if (!courseId || !(await canEditCourse(userId, courseId))) {
        results.push({
          kind: "question",
          id: q.id,
          prompt: q.prompt.slice(0, 200),
          courseId,
          suggestions: [],
          error: "forbidden",
        });
        continue;
      }
      const contentText = [
        `Question (${q.type}): ${q.prompt}`,
        ...q.options.map(
          (o, i) => `Option ${i + 1}: ${o.label}${o.isCorrect ? " ✓" : ""}`,
        ),
        q.explanation ? `Explanation: ${q.explanation}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      try {
        const suggestions = await suggestSkillsForContent(
          userId,
          contentText,
          openai,
        );
        results.push({
          kind: "question",
          id: q.id,
          prompt: q.prompt.slice(0, 200),
          courseId,
          suggestions,
        });
      } catch (e) {
        results.push({
          kind: "question",
          id: q.id,
          prompt: q.prompt.slice(0, 200),
          courseId,
          suggestions: [],
          error:
            e instanceof AiGenerationError ? e.code : (e as Error).message,
        });
      }
    }
  }

  return NextResponse.json({ results, batchLimit: MAX_BATCH });
}
