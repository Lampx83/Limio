import { NextResponse } from "next/server";
import { canEditCourse } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";
import { csvResponse } from "@/lib/csvExport";

export const runtime = "nodejs";

/**
 * Full assignment submission text + grades for a course. Useful for
 * archiving / regrading offline.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!(await canEditCourse(userId, params.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const subs = await prisma.assignmentSubmission.findMany({
    where: { assignment: { lesson: { module: { courseId: params.id } } } },
    orderBy: { submittedAt: "desc" },
    include: {
      user: { select: { displayName: true, email: true } },
      assignment: {
        select: {
          title: true,
          maxScore: true,
          lesson: { select: { title: true } },
        },
      },
    },
  });

  const rows = subs.map((s) => ({
    learner_email: s.user.email,
    learner_name: s.user.displayName,
    lesson: s.assignment.lesson.title,
    assignment: s.assignment.title,
    status: s.status,
    score: s.score ?? "",
    max_score: s.assignment.maxScore,
    feedback: s.feedback ?? "",
    body: s.body,
    attachment_url: s.attachmentUrl ?? "",
    submitted_at: s.submittedAt,
    graded_at: s.gradedAt ?? "",
  }));

  const filename = `submissions-${params.id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.csv`;
  return csvResponse(filename, rows);
}
