import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { createQuiz } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * List quizzes attached to this lesson. Used by the in-video cuepoint
 * editor (AddContentItemForm) to populate the quiz picker. Returns a
 * minimal shape — id + title + question count — no questions/options.
 */
export async function GET(
  _req: Request,
  { params }: { params: { lessonId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const quizzes = await prisma.quiz.findMany({
    where: { lessonId: params.lessonId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      passThresholdPct: true,
      _count: { select: { questions: true } },
    },
  });
  return NextResponse.json({
    quizzes: quizzes.map((q) => ({
      id: q.id,
      title: q.title,
      passThresholdPct: q.passThresholdPct,
      questionCount: q._count.questions,
    })),
  });
}

export async function POST(
  req: Request,
  { params }: { params: { lessonId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const lesson = await prisma.lesson.findUnique({
    where: { id: params.lessonId },
    select: { id: true, module: { select: { courseId: true } } },
  });
  if (!lesson) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await readJson(req);
  try {
    const result = await createQuiz(
      userId,
      { courseId: lesson.module.courseId, lessonId: lesson.id },
      body,
    );
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
