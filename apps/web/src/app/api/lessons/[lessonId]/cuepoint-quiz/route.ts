import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { createCuepointQuiz } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Create a 1-question cuepoint quiz on a lesson. Used by the in-video
 * cuepoint editor when the instructor authors a question inline instead
 * of picking an existing quiz from the dropdown.
 *
 * Body: { atSec, question: { type, prompt, options[], skillIds[], ... } }
 * Returns: { quizId, questionId }
 */
export async function POST(
  req: Request,
  { params }: { params: { lessonId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const lesson = await prisma.lesson.findUnique({
    where: { id: params.lessonId },
    select: { id: true },
  });
  if (!lesson) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await readJson(req);
  try {
    const result = await createCuepointQuiz(userId, params.lessonId, body);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
