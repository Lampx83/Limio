import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { assertCanEditCourse } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** A5.4 — Per-exam item analytics. Returns per-question stats. */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const exam = await prisma.exam.findUnique({
    where: { id: params.id },
    select: { id: true, courseId: true },
  });
  if (!exam)
    return NextResponse.json({ error: "exam_not_found" }, { status: 404 });
  try {
    await assertCanEditCourse(userId, exam.courseId);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }

  const rows = await prisma.examQuestion.findMany({
    where: { examId: exam.id },
    orderBy: { orderInExam: "asc" },
    select: {
      id: true,
      prompt: true,
      type: true,
      points: true,
      orderInExam: true,
      stats: true,
    },
  });
  const items = rows.map((r) => {
    const s = r.stats;
    let flags: string[] = [];
    if (s && s.attemptCount >= 5) {
      if (s.pValue >= 0 && s.pValue < 0.2) flags.push("too_hard");
      if (s.pValue > 0.95) flags.push("too_easy");
      if (s.discrimination >= -1 && s.discrimination < 0.1) flags.push("low_discrimination");
    }
    return {
      id: r.id,
      orderInExam: r.orderInExam,
      prompt: r.prompt.slice(0, 200),
      type: r.type,
      points: r.points,
      attemptCount: s?.attemptCount ?? 0,
      correctCount: s?.correctCount ?? 0,
      pValue: s?.pValue ?? -1,
      discrimination: s?.discrimination ?? -2,
      distractorStats: s?.distractorStats ?? null,
      computedAt: s?.computedAt?.toISOString() ?? null,
      flags,
    };
  });

  return NextResponse.json({ items });
}
