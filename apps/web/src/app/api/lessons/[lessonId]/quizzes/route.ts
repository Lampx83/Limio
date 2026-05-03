import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { createQuiz } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

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
