import { NextResponse } from "next/server";
import { createExam, createExamFromWizard, listExamsForCourse } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

async function resolveCourseId(idOrSlug: string): Promise<string | null> {
  const course = await prisma.course.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    select: { id: true },
  });
  return course?.id ?? null;
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const courseId = await resolveCourseId(params.id);
  if (!courseId) return NextResponse.json({ error: "not_found" }, { status: 404 });
  try {
    const exams = await listExamsForCourse(userId, courseId);
    return NextResponse.json({ exams });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const courseId = await resolveCourseId(params.id);
  if (!courseId) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const body = await readJson(req);
  try {
    // A5.5 — wizard path when body contains wizardConfig
    const result = (body as Record<string, unknown>).wizardConfig
      ? await createExamFromWizard(userId, courseId, body)
      : await createExam(userId, courseId, body);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
